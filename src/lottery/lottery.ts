import { getLotteries } from '@/db/db';
import { saveLottery } from '@/db/db_actions';
import { Bid, Lottery } from '@/db/schema';
import { now, parseAbsolute, ZonedDateTime } from '@internationalized/date';
import { randomUUID } from 'crypto';
import { ChannelType, Client, TextBasedChannel } from 'discord.js';
import schedule from 'node-schedule';

export const enum BidResult {
  SUCCESS,
  ALREADY_BID,
}

export function makeBid(lottery: Lottery, user: string, bid: number): BidResult {
  if (lottery.bids.some((b) => b.user === user)) {
    return BidResult.ALREADY_BID;
  }

  lottery.bids.push({
    id: randomUUID(),
    placedAt: now('UTC').toAbsoluteString(),
    user,
    bid,
  });

  saveLottery(lottery, true);

  return BidResult.SUCCESS;
}

export function processLotteryResults(lottery: Lottery) {
  const client = (globalThis as any).discordBot as Client | undefined;
  if (!client) {
    console.error('Attempted to process lottery results, but the Discord bot was not active');
    return;
  }

  if (lottery.bids.length === 0) {
    console.log(`Lottery ${lottery.id} had no bids`);
    client.channels.fetch(lottery.channel).then((c) => {
      if (c && c.type === ChannelType.GuildText) {
        c.send(`Lottery "${lottery.title}" had no winners, because nobody placed a bid.`);
      }
    });
    return;
  }

  // Group bids by their bidding number
  const remainingBids = new Map<number, Bid[]>();
  for (const b of lottery.bids) {
    const existing = remainingBids.get(b.bid);
    if (!existing) {
      remainingBids.set(b.bid, [b]);
    } else {
      existing.push(b);
    }
  }

  // TODO: implement lowest unique number flow
  const bidPool = [...remainingBids.keys()];
  const winningNumber = bidPool[Math.floor(Math.random() * bidPool.length)];
  const potentialWinners = remainingBids.get(winningNumber);
  if (potentialWinners == null || potentialWinners.length === 0) {
    throw new Error('Selected bid group unexpectedly had no bids');
  }

  const winners = potentialWinners
    .sort((a, b) => {
      if (a.placedAt < b.placedAt) {
        return -1;
      }
      if (a.placedAt > b.placedAt) {
        return 1;
      }
      return 0;
    })
    .slice(0, lottery.winnerCount);

  if (lottery.repeatInterval > 0) {
    updateLotterySchedule(lottery);
  }

  console.log(
    `Winners of "${lottery.title}" (${lottery.id}): ${winners
      .map((w) => `${w.user}: ${w.bid}`)
      .join(', ')}`
  );

  client.channels.fetch(lottery.channel).then((c) => {
    if (c && c.type === ChannelType.GuildText) {
      c.send({
        allowedMentions: { users: winners.map((w) => w.user) },
        content: `Lottery "${
          lottery.title
        }" is over! The winning number is \`${winningNumber}\`, and there were ${
          winners.length
        } winners:\n${winners.map((w) => `<@${w.user}>`).join('\n')}`,
      });
    }
  });
}

export function updateLotterySchedule(lottery: Lottery) {
  const job = schedule.scheduledJobs[lottery.id];
  const nextResultsDate = getNextResultsDate(lottery);
  if (!nextResultsDate) {
    console.log(
      `Attempted to schedule lottery "${lottery.title}" (${lottery.id}), but it was a once-off lottery and has expired.`
    );
    return;
  }
  console.log('Updating lottery schedule for ' + lottery.id);
  if (!job) {
    console.log('Creating new job for ' + lottery.id);
    schedule.scheduleJob(lottery.id, nextResultsDate, () => processLotteryResults(lottery));
  } else {
    console.log('Rescheduling ' + lottery.id);
    job.reschedule(nextResultsDate);
  }
}

// Gets the closest Date in the future for a recurrence of a given Lottery
export function getNextResultsDate(lottery: Lottery): Date | undefined {
  // Do all arithmetic in UTC to ensure no DST or timezone messiness
  const startZdt = parseAbsolute(lottery.startAt, 'UTC');
  const { duration, repeatInterval } = lottery;
  const nowUtc = now('UTC');
  const msDiff = getMsDiff(nowUtc, startZdt);
  const firstDrawDate = drawDateFor(startZdt, lottery.duration);

  if (msDiff < 0) {
    // Start date is in the future already
    return firstDrawDate.toDate();
  }

  if (repeatInterval <= 0 && getMsDiff(firstDrawDate, nowUtc) <= 0) {
    // Draw date has passed, and there are no more recurrences - this lottery will never draw.
    return;
  }

  // Otherwise, find the closest recurrence time
  const closestMultiple = Math.ceil(msDiff / repeatInterval);
  return startZdt
    .add({ milliseconds: closestMultiple * repeatInterval })
    .add({ milliseconds: duration })
    .toDate();
}

function getMsDiff(a: ZonedDateTime, b: ZonedDateTime) {
  return +a.toDate() - +b.toDate();
}

function drawDateFor(start: ZonedDateTime, duration: number) {
  return start.add({ milliseconds: duration });
}

export function deleteLotterySchedule(lottery: Lottery) {
  const job = schedule.scheduledJobs[lottery.id];
  if (job) {
    job.cancel();
  }
}

export async function loadAllLotterySchedules() {
  await schedule.gracefulShutdown();
  for (const lottery of getLotteries()) {
    updateLotterySchedule(lottery);
  }
}

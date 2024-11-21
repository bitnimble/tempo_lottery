import { getLotteries, getLottery } from '@/db/db';
import { saveLottery } from '@/db/db_actions';
import { Bid, Lottery, LotteryType } from '@/db/schema';
import { getDiscordUser } from '@/discord/discord_client_actions';
import { now, parseAbsolute, ZonedDateTime } from '@internationalized/date';
import { randomUUID } from 'crypto';
import { ChannelType, Client, EmbedBuilder } from 'discord.js';
import schedule from 'node-schedule';

export const enum BidResult {
  SUCCESS,
  ALREADY_BID,
}

export function makeBid(lottery: Lottery, user: string, bid: number): BidResult {
  if (lottery.bids.filter((b) => b.user === user).length >= lottery.maxBidsPerUser) {
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

async function processLotteryResults(lottery: Lottery) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const bidMapping = new Map<number, Bid[]>();
  for (const b of lottery.bids) {
    const existing = bidMapping.get(b.bid);
    if (!existing) {
      bidMapping.set(b.bid, [b]);
    } else {
      existing.push(b);
    }
  }
  const bidPool = [...bidMapping.keys()];

  let winners: Bid[] = [];
  let winningNumber: number | undefined;

  if (lottery.lotteryType === LotteryType.SIMPLE) {
    winningNumber = bidPool[Math.floor(Math.random() * bidPool.length)];
    const potentialWinners = bidMapping.get(winningNumber);
    if (potentialWinners == null || potentialWinners.length === 0) {
      throw new Error('Selected bid group unexpectedly had no bids');
    }

    winners = potentialWinners
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
  } else {
    const sortedBidPool = bidPool.sort((a, b) => a - b);
    for (const bid of sortedBidPool) {
      const bids = bidMapping.get(bid);
      if (bids && bids.length === 1) {
        winners = bids;
        winningNumber = bids[0].bid;
        break;
      }
    }
  }

  if (lottery.repeatInterval > 0) {
    updateLotterySchedule(lottery);
  }

  console.log(
    `Winners of "${lottery.title}" (${lottery.id}): ${winners
      .map((w) => `${w.user}: ${w.bid}`)
      .join(', ')}`
  );

  const channel = await client.channels.fetch(lottery.channel);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return;
  }
  const content =
    winners.length === 1
      ? `Lottery "${lottery.title}" is over! The winning number is \`${winningNumber}\`, and the winner is <@${winners[0].user}>`
      : `Lottery "${
          lottery.title
        }" is over! The winning number is \`${winningNumber}\`, and there were ${
          winners.length
        } winners:\n${winners.map((w) => `<@${w.user}>`).join('\n')}`;
  await channel.send({ allowedMentions: { users: winners.map((w) => w.user) }, content });
}

// Take ID instead of Lottery so that we don't capture the lottery metadata at the time of scheduling
async function sendLotteryOpenEmbed(id: string) {
  const lottery = getLottery(id);
  if (!lottery) {
    throw new Error('Tried to send lottery open message but it did not exist in the DB: ' + id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (globalThis as any).discordBot as Client | undefined;
  const resultsDate = getDrawDate(lottery);
  if (!resultsDate || !client) {
    return;
  }

  const channel = await client.channels.fetch(lottery.channel);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return;
  }
  const discordUser = await getDiscordUser(lottery.creator);
  const embed = new EmbedBuilder()
    .setTitle(lottery.title)
    .setDescription(lottery.description || null)
    .setAuthor(discordUser || null)
    .addFields(
      { name: 'Prize', value: lottery.prize || '(none)', inline: true },
      { name: 'Closes', value: `<t:${Math.floor(+resultsDate.toDate() / 1000)}:R>`, inline: true }
    );
  channel.send({ embeds: [embed] });
  await saveLottery({ ...lottery, isAnnounced: true }, true);
}

function createLotteryDrawJob(lottery: Lottery, drawDate: ZonedDateTime) {
  console.log('Updating lottery schedule for ' + lottery.id);
  console.log('Creating new job for ' + lottery.id);
  schedule.scheduleJob(lottery.id, drawDate.toDate(), () => processLotteryResults(lottery));
}

async function createLotteryAnnounceJob(lottery: Lottery, drawDate: ZonedDateTime) {
  const startDate = drawDate.add({ milliseconds: -1 * lottery.duration });
  if (getMsDiff(now('UTC'), startDate) < 0) {
    schedule.scheduleJob(lottery.id + '_announce', startDate.toDate(), () =>
      sendLotteryOpenEmbed(lottery.id)
    );
  } else {
    // Start date was in the past, so just send the message instantly
    await sendLotteryOpenEmbed(lottery.id);
  }
}

export async function updateLotterySchedule(lottery: Lottery) {
  // Delete old scheduled jobs
  const drawJob = schedule.scheduledJobs[lottery.id];
  const lotteryAnnounceJob = schedule.scheduledJobs[lottery.id + '_announce'];
  if (drawJob) {
    console.log('Deleting old draw job for lottery ' + lottery.id);
    drawJob.cancel();
  }
  if (lotteryAnnounceJob) {
    console.log('Deleting old lottery open job for lottery ' + lottery.id);
    lotteryAnnounceJob.cancel();
  }

  // Only published / non-draft lotteries get scheduled
  if (getLottery(lottery.id) == null) {
    return;
  }

  // Create new scheduled jobs
  const drawDate = getDrawDate(lottery);
  if (!drawDate) {
    console.log(
      `Attempted to update schedule for lottery "${lottery.title}" (${lottery.id}), but it was a once-off lottery and has expired.`
    );
    return;
  }
  createLotteryDrawJob(lottery, drawDate);
  if (!lottery.isAnnounced) {
    await createLotteryAnnounceJob(lottery, drawDate);
  }
}

// Gets the closest end Date in the future for a recurrence of a given Lottery
export function getDrawDate(lottery: Lottery): ZonedDateTime | undefined {
  // Do all arithmetic in UTC to ensure no DST or timezone messiness
  const startZdt = parseAbsolute(lottery.startAt, 'UTC');
  const { duration, repeatInterval } = lottery;
  const nowUtc = now('UTC');
  const msDiff = getMsDiff(nowUtc, startZdt);
  const firstDrawDate = drawDateFor(startZdt, lottery.duration);

  if (msDiff < 0) {
    // Start date is in the future already
    return firstDrawDate;
  }

  if (repeatInterval <= 0 && getMsDiff(firstDrawDate, nowUtc) <= 0) {
    // Draw date has passed, and there are no more recurrences - this lottery will never draw.
    return;
  }

  // Otherwise, find the closest recurrence time
  const closestMultiple = Math.ceil(msDiff / repeatInterval);
  return startZdt
    .add({ milliseconds: closestMultiple * repeatInterval })
    .add({ milliseconds: duration });
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
  await Promise.all(getLotteries().map((l) => updateLotterySchedule(l)));
}

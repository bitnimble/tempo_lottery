import { getLotteries } from '@/db/db';
import { saveLottery } from '@/db/db_actions';
import { Bid, Lottery } from '@/db/schema';
import { now, parseAbsolute, ZonedDateTime } from '@internationalized/date';
import { randomUUID } from 'crypto';
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

  saveLottery(lottery);

  return BidResult.SUCCESS;
}

export function processLotteryResults(lottery: Lottery) {
  const winners = [];

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

  while (winners.length < lottery.winnerCount) {
    if (remainingBids.size === 0) {
      // No remaining winners possible as we've exhausted all bids.
      break;
    }

    const bidPool = [...remainingBids.keys()];
    const winningNumber = bidPool[Math.floor(Math.random() * bidPool.length)];
    const potentialWinners = remainingBids.get(winningNumber);
    if (potentialWinners == null || potentialWinners.length === 0) {
      throw new Error('Selected bid group unexpectedly had no bids');
    }

    winners.push(
      ...potentialWinners.sort((a, b) => {
        if (a.placedAt < b.placedAt) {
          return -1;
        }
        if (a.placedAt > b.placedAt) {
          return 1;
        }
        return 0;
      })
    );

    // `potentialWinners` didn't satisfy the required winner count, so just delete that whole bid
    // group and loop.
    if (winners.length < lottery.winnerCount) {
      remainingBids.delete(winningNumber);
    }
  }

  if (lottery.repeatInterval > 0) {
    updateLotterySchedule(lottery);
  }

  // Winner selection finished - we now have >= winnerCount, so slice the first N.
  const finalWinners = winners.slice(0, lottery.winnerCount);
  console.log(
    `Winners of ${lottery.id}: ${finalWinners.map((w) => `${w.user}: ${w.bid}`).join(', ')}`
  );

  // TODO: notify in Discord
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
  if (!job) {
    schedule.scheduleJob(lottery.id, nextResultsDate, () => processLotteryResults(lottery));
  } else {
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

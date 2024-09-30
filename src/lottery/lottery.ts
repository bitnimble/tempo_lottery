import { getLotteries } from '@/db/db';
import { Bid, Lottery } from '@/db/schema';
import { now, parseAbsolute } from '@internationalized/date';
import schedule from 'node-schedule';

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
  if (!job) {
    schedule.scheduleJob(lottery.id, nextResultsDate, () => processLotteryResults(lottery));
  } else {
    job.reschedule(nextResultsDate);
  }
}

// Gets the closest Date in the future for a recurrence of a given Lottery
function getNextResultsDate(lottery: Lottery) {
  // Do all arithmetic in UTC to ensure no DST or timezone messiness
  const startZdt = parseAbsolute(lottery.startAt, 'UTC');
  const start = startZdt.toDate();
  const { duration, repeatInterval } = lottery;
  const msDiff = +now('UTC').toDate() - +start;
  const closestMultiple = Math.ceil(msDiff / repeatInterval);
  const next = startZdt
    .add({ milliseconds: closestMultiple * repeatInterval })
    .add({ milliseconds: duration });
  return next.toDate();
}

export function deleteLotterySchedule(lottery: Lottery) {
  const job = schedule.scheduledJobs[lottery.id];
  if (job) {
    job.cancel();
  }
}

export function loadAllLotterySchedules() {
  for (const lottery of getLotteries()) {
    updateLotterySchedule(lottery);
  }
}

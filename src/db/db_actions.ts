'use server';

import { getDb, saveDb } from '@/db/db';
import { Lottery, LotterySchema } from '@/db/schema';
import { updateLotterySchedule } from '@/lottery/lottery';

export async function saveLottery(lottery: Lottery, skipScheduleUpdate?: boolean) {
  const db = getDb();

  const existing = db.lotteries.findIndex((l) => l.id === lottery.id);
  if (existing >= 0) {
    db.lotteries.splice(existing, 1, LotterySchema.parse(lottery));
    saveDb();

    if (skipScheduleUpdate !== true) {
      await updateLotterySchedule(lottery);
    }
    return;
  }

  const existingDraft = db.drafts.findIndex((l) => l.id === lottery.id);
  if (existingDraft >= 0) {
    db.drafts.splice(existingDraft, 1, LotterySchema.parse(lottery));
  }

  saveDb();
}

export async function tryPromoteLottery(draftId: string) {
  const db = getDb();
  const draft = db.drafts.findIndex((l) => l.id === draftId);
  if (draft < 0) {
    throw new Error('Could not find matching draft ID: ' + draftId);
  }

  const lottery = LotterySchema.parse(db.drafts[draft]);
  db.drafts.splice(draft, 1);
  db.lotteries.push(lottery);

  saveDb();
  await updateLotterySchedule(lottery);
}

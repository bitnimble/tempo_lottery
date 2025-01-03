'use server';

import { getDb, getLottery, saveDb } from '@/db/db';
import { Bid, Lottery, LotterySchema } from '@/db/schema';
import { updateLotterySchedule as _updateLotterySchedule } from '@/lottery/lottery';

export async function saveLottery(lottery: Lottery) {
  const db = getDb();

  const existing = db.lotteries.findIndex((l) => l.id === lottery.id);
  if (existing >= 0) {
    // Get latest bids and ensure we don't wipe it
    // TODO: just store bids in a separate part of the db, this can potentially race
    const bids = db.lotteries[existing].bids;
    db.lotteries.splice(
      existing,
      1,
      LotterySchema.parse({
        ...lottery,
        bids,
      })
    );
    saveDb();
    return;
  }

  const existingDraft = db.drafts.findIndex((l) => l.id === lottery.id);
  if (existingDraft >= 0) {
    db.drafts.splice(existingDraft, 1, LotterySchema.parse(lottery));
    saveDb();
  }
}

export async function saveLotteryBids(id: string, bids: Bid[]) {
  const db = getDb();

  const existing = db.lotteries.findIndex((l) => l.id === id);
  if (existing >= 0) {
    const lottery = db.lotteries[existing];
    db.lotteries.splice(
      existing,
      1,
      LotterySchema.parse({
        ...lottery,
        bids,
      })
    );
    saveDb();
  }
}

export async function tryPublishLottery(draftId: string) {
  const db = getDb();
  const draftIndex = db.drafts.findIndex((l) => l.id === draftId);
  if (draftIndex < 0) {
    throw new Error('Could not find matching draft ID: ' + draftId);
  }

  const lottery = LotterySchema.parse(db.drafts[draftIndex]);
  db.drafts.splice(draftIndex, 1);
  db.lotteries.push(lottery);

  saveDb();
  await _updateLotterySchedule(lottery);
}

export async function tryUnpublishLottery(id: string) {
  const db = getDb();
  const lotteryIndex = db.lotteries.findIndex((l) => l.id === id);
  if (lotteryIndex < 0) {
    throw new Error('Could not find matching lottery ID: ' + id);
  }

  const lottery = LotterySchema.parse(db.lotteries[lotteryIndex]);
  db.lotteries.splice(lotteryIndex, 1);
  db.drafts.push(lottery);

  saveDb();
  await _updateLotterySchedule(lottery);
}

export async function tryDeleteLottery(id: string) {
  const db = getDb();
  const existing = db.lotteries.findIndex((l) => l.id === id);
  if (existing >= 0) {
    const [lottery] = db.lotteries.splice(existing, 1);
    saveDb();
    await _updateLotterySchedule(lottery);
    return;
  }

  const existingDraft = db.drafts.findIndex((l) => l.id === id);
  if (existingDraft >= 0) {
    db.drafts.splice(existingDraft, 1);
    saveDb();
  }
}

export async function updateLotterySchedule(id: string) {
  const lottery = getLottery(id);
  if (!lottery) {
    return;
  }
  _updateLotterySchedule(lottery);
}

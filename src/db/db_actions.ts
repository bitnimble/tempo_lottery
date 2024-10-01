'use server';

import { getDb, saveDb } from '@/db/db';
import { Lottery, LotterySchema } from '@/db/schema';
import { getNextResultsDate, updateLotterySchedule } from '@/lottery/lottery';
import { ChannelType, Client } from 'discord.js';

export async function saveLottery(lottery: Lottery, skipScheduleUpdate?: boolean) {
  const db = getDb();

  const existing = db.lotteries.findIndex((l) => l.id === lottery.id);
  if (existing >= 0) {
    db.lotteries.splice(existing, 1, LotterySchema.parse(lottery));
    saveDb();

    if (skipScheduleUpdate !== true) {
      updateLotterySchedule(lottery);
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

  const resultsDate = getNextResultsDate(lottery);
  if (resultsDate) {
    const client = (globalThis as any).discordBot as Client | undefined;
    if (client) {
      const channel = await client.channels.fetch(lottery.channel);
      if (channel && channel.type === ChannelType.GuildText) {
        channel.send(
          `Lottery "${
            lottery.title
          }" has been created, and results will be drawn at <t:${Math.floor(
            +resultsDate / 1000
          )}:F>`
        );
      }
    }
  }

  saveDb();
  updateLotterySchedule(lottery);
}

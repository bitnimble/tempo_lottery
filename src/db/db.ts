// Move to something like PicoDB / Mongo / SQlite if we need to.
// Otherwise, for now we just persist configurations as JSON on disk, and do everything in memory
// to deal with concurrency.
import fs from 'fs';
import z from 'zod';
import { Lottery, LotterySchema } from './schema';

const Db = z.object({
  lotteries: z.array(LotterySchema).default([]),
  drafts: z.array(LotterySchema).default([]),
});

reloadDb();

export function getDb() {
  return (globalThis as any).lotteryDb as z.infer<typeof Db>;
}

export function getLotteries() {
  return getDb().lotteries;
}

export function getLottery(id: string) {
  return getDb().lotteries.find((l) => l.id === id);
}

export function getDraftLottery(id: string) {
  return getDb().drafts.find((l) => l.id === id);
}

export function createDraftLottery(
  params: Pick<Lottery, 'title' | 'channel' | 'roles' | 'creator' | 'adminCreator' | 'startAt'>
) {
  const id = crypto.randomUUID();
  getDb().drafts.push(LotterySchema.parse({ ...params, id }));
  saveDb();
  return id;
}

export function saveDb() {
  fs.writeFileSync('db.json', JSON.stringify(Db.parse(getDb()), undefined, 2));
}

export function reloadDb() {
  (globalThis as any).lotteryDb = loadDbFromDisk();
}

function loadDbFromDisk() {
  if (!fs.existsSync('db.json')) {
    const db = Db.parse({});
    fs.writeFileSync('db.json', JSON.stringify(db, undefined, 2));
    return db;
  }
  const dbUnparsed = JSON.parse(fs.readFileSync('db.json').toString());
  return Db.parse(dbUnparsed);
}

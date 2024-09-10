// Move to something like PicoDB / Mongo / SQlite if we need to.
// Otherwise, for now we just persist configurations as JSON on disk, and do everything in memory
// to deal with concurrency.
import fs from 'fs';
import z from 'zod';
import { LotterySchema } from './schema';

const Db = z.object({
  lotteries: z.array(LotterySchema),
});

let db = loadDbFromDisk();

export function getLotteries() {
  return db.lotteries;
}

export function createLottery(lottery: z.infer<typeof LotterySchema>) {
  db.lotteries.push(LotterySchema.parse(lottery));
  saveDb();
}

export function saveDb() {
  fs.writeFileSync('db.json', JSON.stringify(Db.parse(db), undefined, 2));
}

export function reloadDb() {
  db = loadDbFromDisk();
}

function loadDbFromDisk() {
  const dbUnparsed = JSON.parse(fs.readFileSync('db.json').toString());
  return Db.parse(dbUnparsed);
}

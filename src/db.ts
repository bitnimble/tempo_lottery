// Move to something like PicoDB / Mongo / SQlite if we need to.
// Otherwise, for now we just persist configurations as JSON on disk, and do everything in memory
// to deal with concurrency.
import fs from 'fs';
import z from 'zod';
import { Lottery, LotteryType } from './schema';

const Db = z.object({
  lotteries: z.array(Lottery),
});

let db = loadDbFromDisk();

export function getLotteries() {
  return db.lotteries;
}

export function createLottery() {
  db.lotteries.push({
    title: 'title',
    type: LotteryType.SIMPLE,
    description: 'description',
    banner:
      'https://images.unsplash.com/photo-1536500152107-01ab1422f932?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    prize: '420 dollars',
    host: '1234',
    roles: [],
    startAt: new Date(),
    duration: 30,
    repeat: 0,
    winnerCount: 1,
  });
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

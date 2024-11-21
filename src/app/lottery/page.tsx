import { Preconditions } from '@/app/base/preconditions';
import { getDb } from '@/db/db';
import { Lottery } from '@/db/schema';
import { getDrawDate } from '@/lottery/lottery';
import { Client } from 'discord.js';

export default async function Page() {
  const client = (globalThis as any).discordBot as Client | undefined;
  if (!client) {
    return 'Waiting for Discord bot to start... refresh in 10 seconds.';
  }
  const db = getDb();
  const { lotteries, drafts } = db;
  return (
    <div className="prose flex flex-col max-w-5xl m-auto my-8">
      <h2>Active lotteries</h2>
      <ul className="p-0 m-0">
        {lotteries.length === 0 && 'None'}
        {lotteries.map((l) => (
          <LotteryListItem lottery={l} />
        ))}
      </ul>

      <h2>Draft lotteries</h2>
      <ul className="p-0 m-0">
        {drafts.length === 0 && 'None'}
        {drafts.map((l) => (
          <LotteryListItem lottery={l} />
        ))}
      </ul>
    </div>
  );
}

async function LotteryListItem(props: { lottery: Lottery }) {
  const client = Preconditions.checkExists((globalThis as any).discordBot) as Client;
  const l = props.lottery;
  const creator = await client.users.fetch(l.creator);
  return (
    <li key={l.id} className="p-0 list-none">
      {/* TODO: use a Next link for prefetching on hover, but need to also add a loading spinner somewhere then */}
      <a href={`/lottery/${l.id}`} className="no-underline">
        <div className="rounded-md border border-input hover:border-black px-4 py-2 transition">
          <h4 className="m-0">{l.title}</h4>
          <p className="m-0 font-normal text-sm">
            Created by: {creator.displayName}
            <br />
            Prize: {l.prize || 'None'}
            <br />
            Ends: {getDrawDate(l)?.toString() || 'Already ended'}
          </p>
        </div>
      </a>
    </li>
  );
}

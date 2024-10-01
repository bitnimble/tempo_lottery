import { createDiscordBot } from '@/discord/create';
import { loadAllLotterySchedules } from '@/lottery/lottery';
import 'dotenv/config';

export async function installDiscordBot() {
  if ((globalThis as any).discordBot) {
    console.log('Attempted to load Discord bot but it was already loaded');
    return;
  }
  console.log('Loading the Discord bot...');
  const client = createDiscordBot();
  (globalThis as any).discordBot = client;
  client.login(process.env.DISCORD_TOKEN);

  await loadAllLotterySchedules();
}

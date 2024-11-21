import { installDiscordBot } from '@/app/load_discord/discord_installer';
import { Client } from 'discord.js';

export default function Discord() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (globalThis as any).discordBot as Client | undefined;
  if (client && client.isReady()) {
    return <div>Discord bot already active! Logged in as {client.user.tag}</div>;
  }
  installDiscordBot();
  return <div>Activated the Discord bot and loaded job scheduler</div>;
}

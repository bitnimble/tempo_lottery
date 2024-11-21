'use server';

import { Client } from 'discord.js';

export async function getDiscordUser(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (globalThis as any).discordBot as Client | undefined;
  if (!client) {
    return;
  }
  const user = await client.users.fetch(id);
  return {
    name: user.displayName,
    iconURL: user.avatarURL() || undefined,
  };
}

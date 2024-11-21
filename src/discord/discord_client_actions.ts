'use server';

import { Client } from 'discord.js';

export async function getDiscordUser(id: string) {
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

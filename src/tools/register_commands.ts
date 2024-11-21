import { CREATE_LOTTERY, ENTER_LOTTERY } from '@/discord/commands';
import { RESTPutAPIApplicationCommandsJSONBody } from 'discord.js';
import 'dotenv/config';
import fetch, { RequestInit } from 'node-fetch';

const appId = process.env.APP_ID;
if (!appId) {
  throw new Error('missing app id');
}

async function makeDiscordRequest(endpoint: string, options: Partial<RequestInit>) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot',
    },
    ...options,
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function installGlobalCommands(
  appId: string,
  commands: RESTPutAPIApplicationCommandsJSONBody
) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    const res = await makeDiscordRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(commands),
    });
    console.log(res.status);
    res.json().then((r) => console.log(r));
  } catch (err) {
    console.error(err);
  }
}

installGlobalCommands(appId, [CREATE_LOTTERY, ENTER_LOTTERY]);

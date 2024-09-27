import { createDraftLottery } from '@/db/db';
import { CREATE_LOTTERY } from '@/discord/commands';
import { Client, Events, GatewayIntentBits } from 'discord.js';

export function createDiscordBot() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === CREATE_LOTTERY.name) {
          const id = createDraftLottery();
          await interaction.reply({
            content: `http://localhost:3000/lottery/${id}`,
            ephemeral: true,
          });
        }
      }
    } catch (e) {
      // Modal submission probably expired
    }
  });
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Discord bot loaded! Ready as ${readyClient.user.tag}`);
  });
  return client;
}

'use server';

import { getLottery } from '@/db/db';
import { saveLottery } from '@/db/db_actions';
import { lotteryTypeLabels } from '@/db/schema';
import { getFirstDrawDate, getNextDrawDate } from '@/lottery/lottery';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
} from 'discord.js';

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

// Take ID instead of Lottery so that we don't capture the lottery metadata at the time of scheduling
export async function upsertLotteryAnnouncement(id: string, forceNewMessage?: boolean) {
  const lottery = getLottery(id);
  if (!lottery) {
    throw new Error('Tried to send lottery open message but it did not exist in the DB: ' + id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (globalThis as any).discordBot as Client | undefined;
  if (!client) {
    return;
  }

  const channel = await client.channels.fetch(lottery.channel);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return;
  }
  const drawDate = getNextDrawDate(lottery);
  const isLotteryOpen = drawDate != null;
  const discordUser = await getDiscordUser(lottery.creator);
  const embed = new EmbedBuilder()
    .setTitle(lottery.title)
    .setDescription(lottery.description || null)
    .setAuthor(discordUser || null)
    .addFields(
      { name: 'Type', value: lotteryTypeLabels[lottery.lotteryType], inline: true },
      { name: 'Prize', value: lottery.prize || '(none)', inline: true },
      {
        name: 'Closes',
        value: drawDate
          ? `<t:${Math.floor(+drawDate.toDate() / 1000)}:R>`
          : `<t:${Math.floor(+getFirstDrawDate(lottery).toDate() / 1000)}:R>`,
        inline: true,
      }
    );

  const messagePayload = {
    embeds: [embed],
    components: isLotteryOpen
      ? [
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('Enter lottery')
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`enter_${id}`)
          ),
        ]
      : [],
  };

  if (lottery.announcementId && !forceNewMessage) {
    await channel.messages.edit(lottery.announcementId, messagePayload);
  } else {
    const message = await channel.send(messagePayload);
    await saveLottery({ ...lottery, announcementId: message.id });
  }
}

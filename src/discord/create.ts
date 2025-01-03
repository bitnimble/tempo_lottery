import { Preconditions } from '@/app/base/preconditions';
import { createDraftLottery, getLotteries, getLottery, saveDb } from '@/db/db';
import { Lottery, LotteryType } from '@/db/schema';
import { CREATE_LOTTERY, ENTER_LOTTERY } from '@/discord/commands';
import { getNextDrawDate, makeBids } from '@/lottery/lottery';
import { now } from '@internationalized/date';
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  GuildMemberRoleManager,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalActionRowComponentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

async function handleCreateLottery(interaction: ChatInputCommandInteraction) {
  const roles = interaction.member?.roles;
  const lotteryAdminRole = Preconditions.checkExists(process.env.LOTTERY_ADMIN_ROLE);
  if (roles == null) {
    await interaction.reply({
      content: 'Could not load your user roles; please try again later',
      ephemeral: true,
    });
    return;
  } else if (roles instanceof GuildMemberRoleManager) {
    if (!roles.cache.has(lotteryAdminRole)) {
      await interaction.reply({
        content: 'You do not have permission to create a lottery.',
        ephemeral: true,
      });
      return;
    }
  } else {
    if (!roles.includes(lotteryAdminRole)) {
      await interaction.reply({
        content: 'You do not have permission to create a lottery.',
        ephemeral: true,
      });
      return;
    }
  }

  const creator = interaction.options.getUser('creator')?.id;
  const role = interaction.options.getRole('required_role')?.id;
  const name = interaction.options.getString('name');
  if (name == null) {
    throw new Error('Expected lottery name, but found undefined');
  }
  const id = createDraftLottery({
    title: name,
    channel: interaction.options.getChannel('channel')?.id || interaction.channelId,
    roles: role ? [role] : undefined,
    creator: creator || interaction.user.id,
    adminCreator: interaction.user.id,
    startAt: now('UTC').set({ second: 0, millisecond: 0 }).toAbsoluteString(),
  });

  console.log(`Created lottery "${name}" (${id})`);

  await interaction.reply({
    content: `Created draft lottery "${name}": http://${process.env.HOST}/lottery/${id}. This lottery still needs to be published to become active.`,
    ephemeral: true,
  });
}

async function pickLotteryToEnter(interaction: ChatInputCommandInteraction) {
  // Create select dropdown with active lotteries to pick from
  const lotteryOptions = new StringSelectMenuBuilder()
    .setCustomId('lottery_id')
    .setPlaceholder('Pick a lottery')
    .addOptions(
      getLotteries()
        .map((l) => {
          const resultsDate = getNextDrawDate(l);
          if (!resultsDate || +now('UTC').toDate() - +resultsDate.toDate() >= 0) {
            return;
          }
          const option = new StringSelectMenuOptionBuilder().setLabel(l.title).setValue(l.id);
          if (l.description) {
            option.setDescription(l.description || '');
          }
          return option;
        })
        .filter((l) => l != null)
    );

  if (lotteryOptions.options.length === 0) {
    await interaction.reply({
      content: 'There are no active lotteries.',
      ephemeral: true,
    });
    return;
  }

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    lotteryOptions
  );
  const response = await interaction.reply({
    components: [row],
    ephemeral: true,
  });

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60_000,
    });
    if (confirmation.customId !== 'lottery_id' || !confirmation.isStringSelectMenu()) {
      await interaction.editReply('Unknown error.');
      return;
    }
    const selectedLotteryId = confirmation.values[0];
    return {
      interaction: confirmation,
      lottery: getLottery(selectedLotteryId),
    };
  } catch (e) {
    console.log(e);
    await interaction.editReply({
      content: 'A selection was not made within 1 minute; cancelling',
      components: [],
    });
  }
}

async function handleEnterLottery(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  lottery: Lottery
) {
  if (lottery.bids.filter((b) => b.user === interaction.user.id).length >= lottery.maxBidsPerUser) {
    await interaction.reply({
      content: `You have already bid the maximum number of times on this lottery (${lottery.maxBidsPerUser}).`,
      ephemeral: true,
    });
    return;
  }

  const resultsDate = getNextDrawDate(lottery);
  if (!resultsDate || +now('UTC').toDate() - +resultsDate.toDate() >= 0) {
    await interaction.reply({
      content: 'This lottery has closed.',
      ephemeral: true,
    });
    return;
  }

  if (lottery.lotteryType === LotteryType.LOWEST_UNIQUE_NUMBER) {
    // For the lowest unique number lottery, allow users to submit their own bids.
    const bidsResult = await collectBidsForLottery(interaction, lottery);
    if (bidsResult == null) {
      return;
    }
    const [modalConfirmation, bids] = bidsResult;
    const successfulBids = await makeBids(lottery, interaction.user.id, bids);
    if (successfulBids < bids.length) {
      await modalConfirmation.reply({
        content: `You hit the maximum number of bids (${lottery.maxBidsPerUser
          }). Your first ${successfulBids} bid(s) were successfully entered: \`${bids.slice(0, successfulBids).join(', ')}\`.`,
        ephemeral: true,
      });
    } else {
      await modalConfirmation.reply({
        content: `You have bid \`${bids.join(', ')}\` on "${lottery.title}"!`,
        ephemeral: true,
      });
    }
  } else {
    // Otherwise, simply assign them an incrementing raffle number and tell them what it is.
    const nextBid = lottery.nextBid++;
    saveDb();
    const successfulBids = await makeBids(lottery, interaction.user.id, [nextBid]);
    if (successfulBids !== 1) {
      console.error(`Could not successfully enter bid ${nextBid} into lottery ${lottery.id}`);
      return await interaction.reply({
        content: `Could not successfully enter bid. Please try again later.`,
        ephemeral: true,
      });
    }
    return await interaction.reply({
      content: `You have entered the lottery and have been assigned ticket #${nextBid}! The winning ticket will be randomly selected when the lottery ends.`,
      ephemeral: true,
    });
  }
}

// Pull this out into its own function, so that if Discord allows us to do chained modals in the
// future, we can easily chain more (e.g. retry on validation failure)
async function collectBidsForLottery(
  interaction: ChatInputCommandInteraction | MessageComponentInteraction,
  lottery: Lottery
) {
  await interaction.showModal({
    customId: 'lottery_bid_modal',
    title: `Enter your lottery bids (between ${lottery.minimumBid} - ${lottery.maximumBid})`,
    components: new Array(Math.min(5, lottery.maxBidsPerUser)).fill(0).map((_, i) => {
      return new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(`lottery_bid_${i + 1}`)
          .setLabel(`Bid ${i + 1}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(i === 0 ? true : false)
      );
    }),
  });
  const modalConfirmation = await interaction.awaitModalSubmit({
    filter: (i) => i.user.id === interaction.user.id,
    time: 60_000,
  });
  const bids = modalConfirmation.components
    .map((c) => c.components[0].value)
    .filter((v) => v.trim() !== '');
  for (const bid of bids) {
    const bidNumber = Number(bid);
    if (isNaN(bidNumber) || bidNumber < lottery.minimumBid || bidNumber > lottery.maximumBid) {
      await modalConfirmation.reply({
        content: `Invalid bid entered ("${bid}") - please make sure it is a valid number in the possible bid range.`,
        ephemeral: true,
      });
      return;
    }
  }

  return [modalConfirmation, bids.map(Number)] as const;
}

export function createDiscordBot() {
  if (!process.env.LOTTERY_ADMIN_ROLE || process.env.LOTTERY_ADMIN_ROLE.trim() === '') {
    throw new Error(
      'LOTTERY_ADMIN_ROLE is missing from .env or empty, but is required to start the Discord bot'
    );
  }
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isMessageComponent()) {
        if (interaction.customId.startsWith('enter_')) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_, id] = interaction.customId.split('_', 2);
          const lottery = getLottery(id);
          if (!lottery) {
            await interaction.reply({
              content: 'The selected lottery is no longer available.',
              ephemeral: true,
            });
            return;
          }
          await handleEnterLottery(interaction, lottery);
        }
      } else if (interaction.isChatInputCommand()) {
        if (interaction.commandName === CREATE_LOTTERY.name) {
          await handleCreateLottery(interaction);
        } else if (interaction.commandName === ENTER_LOTTERY.name) {
          const pickResult = await pickLotteryToEnter(interaction);
          if (!pickResult) {
            return;
          }
          if (!pickResult.lottery) {
            await pickResult.interaction.reply({
              content: 'The selected lottery is no longer available.',
              ephemeral: true,
            });
            return;
          }
          await handleEnterLottery(pickResult.interaction, pickResult.lottery);
        }
      }
    } catch (e) {
      // Modal submission probably expired
      console.log(e);
    }
  });
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Discord bot loaded! Ready as ${readyClient.user.tag}`);
  });
  return client;
}

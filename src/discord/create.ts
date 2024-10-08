import { Preconditions } from '@/app/base/preconditions';
import { createDraftLottery, getLotteries, getLottery } from '@/db/db';
import { Lottery } from '@/db/schema';
import { CREATE_LOTTERY, ENTER_LOTTERY } from '@/discord/commands';
import { BidResult, getDrawDate, makeBid } from '@/lottery/lottery';
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
    content: `http://${process.env.HOST}/lottery/${id}`,
    ephemeral: true,
  });
}

async function handleEnterLottery(interaction: ChatInputCommandInteraction) {
  // Create select dropdown with active lotteries to pick from
  const lotteryOptions = new StringSelectMenuBuilder()
    .setCustomId('lottery_id')
    .setPlaceholder('Pick a lottery')
    .addOptions(
      getLotteries()
        .map((l) => {
          const resultsDate = getDrawDate(l);
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
    const lottery = getLottery(selectedLotteryId);
    if (!lottery) {
      await interaction.editReply('The selected lottery is no longer available. Please try again.');
      return;
    }
    if (
      lottery.bids.filter((b) => b.user === interaction.user.id).length >= lottery.maxBidsPerUser
    ) {
      await interaction.editReply({
        content: `You have already bid the maximum number of times on this lottery (${lottery.maxBidsPerUser}).`,
      });
      return;
    }

    const bidResult = await collectBidForLottery(interaction, confirmation, lottery);
    if (bidResult == null) {
      return;
    }
    const [modalConfirmation, bid] = bidResult;
    const result = makeBid(lottery, interaction.user.id, bid);
    if (result == BidResult.ALREADY_BID) {
      await modalConfirmation.reply({
        content: `You have already bid the maximum number of times on this lottery (${lottery.maxBidsPerUser}).`,
        ephemeral: true,
      });
    } else {
      await modalConfirmation.reply({
        content: `You have bid \`${bid}\` on "${lottery.title}"!`,
        ephemeral: true,
      });
    }
    await interaction.deleteReply();
  } catch (e) {
    console.log(e);
    await interaction.editReply({
      content: 'A selection was not made within 1 minute; cancelling',
      components: [],
    });
  }
}

// Pull this out into its own function, so that if Discord allows us to do chained modals in the
// future, we can easily chain more (e.g. retry on validation failure)
async function collectBidForLottery(
  originalInteraction: ChatInputCommandInteraction,
  interaction: MessageComponentInteraction,
  lottery: Lottery
) {
  await interaction.showModal({
    customId: 'lottery_bid_modal',
    title: 'Enter your lottery bid',
    components: [
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('lottery_bid')
          .setLabel(`Bid (${lottery.minimumBid} - ${lottery.maximumBid})`)
          .setStyle(TextInputStyle.Short)
      ),
    ],
  });
  const modalConfirmation = await interaction.awaitModalSubmit({
    filter: (i) => i.user.id === interaction.user.id,
    time: 60_000,
  });
  const bid = Number(modalConfirmation.components[0].components[0].value);
  if (isNaN(bid) || bid < lottery.minimumBid || bid > lottery.maximumBid) {
    await originalInteraction.editReply(
      'Invalid bid entered - please make sure it is a valid number in the possible bid range.'
    );
    return;
  }

  return [modalConfirmation, bid] as const;
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
      if (!interaction.isChatInputCommand()) {
        return;
      }
      if (interaction.commandName === CREATE_LOTTERY.name) {
        await handleCreateLottery(interaction);
      } else if (interaction.commandName === ENTER_LOTTERY.name) {
        await handleEnterLottery(interaction);
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

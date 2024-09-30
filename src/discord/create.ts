import { createDraftLottery, getLotteries, getLottery } from '@/db/db';
import { Lottery } from '@/db/schema';
import { CREATE_LOTTERY, ENTER_LOTTERY } from '@/discord/commands';
import { BidResult, loadAllLotterySchedules, makeBid } from '@/lottery/lottery';
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalActionRowComponentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

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
        } else if (interaction.commandName === ENTER_LOTTERY.name) {
          const lotteryOptions = new StringSelectMenuBuilder()
            .setCustomId('lottery_id')
            .setPlaceholder('Pick a lottery')
            .addOptions(
              getLotteries().map((l) => {
                return new StringSelectMenuOptionBuilder()
                  .setLabel(l.title)
                  .setDescription(l.description)
                  .setValue(l.id);
              })
            );

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
              await interaction.editReply(
                'The selected lottery is no longer available. Please try again.'
              );
              return;
            }
            if (lottery.bids.some((b) => b.user === interaction.user.id)) {
              await interaction.editReply({
                content: `You have already bid on this lottery.`,
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
                content: `You have already bid on this lottery.`,
                ephemeral: true,
              });
            } else {
              await modalConfirmation.reply({
                content: `You have bid \`${bid}\` on the "${lottery.title}" lottery`,
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

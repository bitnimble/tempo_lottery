import { SlashCommandBuilder } from 'discord.js';

// Simple test command
export const CREATE_LOTTERY = new SlashCommandBuilder()
  .setName('create_lottery')
  .addStringOption((option) =>
    option.setName('name').setDescription('Name of the lottery').setRequired(true)
  )
  .addChannelOption((option) =>
    option.setName('channel').setDescription('The channel where the draw results will be posted')
  )
  .addUserOption((option) =>
    option.setName('creator').setDescription('The user to credit as creating this lottery')
  )
  .addRoleOption((option) =>
    option
      .setName('required_role')
      .setDescription('Required role needed to participate in the lottery')
  )
  .setDescription('Creates a new lottery')
  .toJSON();

export const ENTER_LOTTERY = new SlashCommandBuilder()
  .setName('enter_lottery')
  .setDescription('Enters a lottery')
  .toJSON();

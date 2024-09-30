import { SlashCommandBuilder } from 'discord.js';

// Simple test command
export const CREATE_LOTTERY = new SlashCommandBuilder()
  .setName('create_lottery')
  .addChannelOption((option) =>
    option.setName('channel').setDescription('The channel where the draw results will be posted')
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

import { SlashCommandBuilder } from 'discord.js';

// Simple test command
export const CREATE_LOTTERY = new SlashCommandBuilder()
  .setName('create_lottery')
  .setDescription('Creates a new lottery')
  .toJSON();

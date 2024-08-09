import 'dotenv/config';
import { installGlobalCommands } from './utils.js';

// Simple test command
export const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1, // CHAT_INPUT
};

const appId = process.env.APP_ID;
if (!appId) {
  throw new Error('missing app id');
}

installGlobalCommands(appId, [TEST_COMMAND]);

import { CREATE_LOTTERY } from '../src/commands';
import { installGlobalCommands } from '../src/utils';

const appId = process.env.APP_ID;
if (!appId) {
  throw new Error('missing app id');
}

installGlobalCommands(appId, [CREATE_LOTTERY]);

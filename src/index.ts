import {
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import { TEST_COMMAND } from './commands';

const app = express();
const port = process.env.PORT || 3000;
const publicKey = process.env.PUBLIC_KEY;
if (!publicKey) {
  throw new Error('missing public key');
}

app.post('/interactions', verifyKeyMiddleware(publicKey), async (req: Request, res: Response) => {
  const { type, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === TEST_COMMAND.name) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `hello response`,
        },
      });
    }

    console.error(`unknown command received: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error(`unknown interaction type: ${type}`);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

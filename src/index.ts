import {
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import { CREATE_LOTTERY } from './commands';
import Crypto from 'crypto';
import z from 'zod';
import { createLottery } from './db';
import { Lottery, LotterySchema, LotteryType } from 'schema';

type StringProperties<T extends { custom_id: string }[]> = {
  [K in T[number]['custom_id']]: string;
};

const app = express();
const port = process.env.PORT || 3000;
const publicKey = process.env.PUBLIC_KEY;
if (!publicKey) {
  throw new Error('missing public key');
}

const inflightModals = new Map<string, Partial<Record<keyof Lottery, string>>>();

app.post('/interactions', verifyKeyMiddleware(publicKey), async (req: Request, res: Response) => {
  const { type, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === CREATE_LOTTERY.name) {
      console.log('creating lottery modal');
      console.log(JSON.stringify(createLotteryModalComponentsPage1, undefined, 2));

      return res.send({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: Crypto.randomUUID().toString() + '_1',
          title: 'Create a new lottery',
          components: [
            {
              type: 1,
              components: createLotteryModalComponentsPage1,
            },
          ],
        },
      });
    } else if (type === InteractionType.MODAL_SUBMIT) {
      console.log('received modal submission');
      const { custom_id, components } = data;
      const getComponentValues = () =>
        Object.fromEntries(components.map((c: any) => [c.custom_id, c.value])) as any;

      const uuid = custom_id.substring(0, custom_id.length - 2);

      // TODO: abstract out the pagination
      if (custom_id.endsWith('_1')) {
        const page1Properties: StringProperties<typeof createLotteryModalComponentsPage1> =
          getComponentValues();
        inflightModals.set(uuid, page1Properties);

        // Send page 2 modal
        return res.send({
          type: InteractionResponseType.MODAL,
          data: {
            custom_id: uuid + '_2',
            title: 'Create a new lottery',
            components: [{ type: 1, components: createLotteryModalComponentsPage2 }],
          },
        });
      } else if (custom_id.endsWith('_2')) {
        const existingProperties = inflightModals.get(uuid);
        if (!existingProperties) {
          return res
            .status(400)
            .json({ error: 'received page 2 properties for unknown lottery id' });
        }

        const page2Properties: StringProperties<typeof createLotteryModalComponentsPage2> =
          getComponentValues();
        inflightModals.set(uuid, { ...existingProperties, ...page2Properties });
      } else if (custom_id.endsWith('_3')) {
        const existingProperties = inflightModals.get(uuid);
        if (!existingProperties) {
          return res
            .status(400)
            .json({ error: 'received page 3 properties for unknown lottery id' });
        }

        const page3Properties: StringProperties<typeof createLotteryModalComponentsPage3> =
          getComponentValues();

        const _finalProperties = { ...existingProperties, ...page3Properties };
        // hacks, fix this
        const finalProperties: Required<typeof _finalProperties> = _finalProperties as Required<
          typeof _finalProperties
        >;

        try {
          const newLottery: Lottery = {
            id: uuid,
            title: finalProperties.title,
            lotteryType: finalProperties.lotteryType as LotteryType,
            description: finalProperties.description,
            banner: finalProperties.banner, // todo make nullable
            prize: finalProperties.prize,
            host: finalProperties.host,
            roles: finalProperties.roles.split('\n').map((l) => l.trim()),
            startAt: new Date(finalProperties.startAt),
            duration: parseInt(finalProperties.duration),
            repeatInterval: parseInt(finalProperties.repeatInterval),
            winnerCount: parseInt(finalProperties.winnerCount),
          };

          if (
            isNaN(newLottery.duration) ||
            isNaN(newLottery.repeatInterval) ||
            isNaN(newLottery.winnerCount)
          ) {
            throw new Error('could not parse numeric parameters');
          }

          createLottery(newLottery as Lottery);

          return res.status(200).json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Lottery created!',
            },
          });
        } catch (e) {
          return res.status(400).json({ error: 'invalid create lottery parameters' });
        }
      }
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

const createLotteryModalComponentsPage1 = [
  textInputFor('title'),
  // textInputFor('lotteryType'),
  // placeholder: 'SIMPLE or LOWEST_UNIQUE_NUMBER',
  // {
  //   ...textInputFor('description'),
  //   style: 2, // Multi-line paragraph input
  // },
  // textInputFor('banner'), // todo make nullable
  textInputFor('prize'),
];
const createLotteryModalComponentsPage2 = [
  textInputFor('host'),
  {
    ...textInputFor('roles'),
    style: 2,
  },
  {
    ...textInputFor('startAt'),
    placeholder: '2024-01-30T10:30:00+10:00',
  },
  textInputFor('duration'),
  textInputFor('repeatInterval'),
];
const createLotteryModalComponentsPage3 = [textInputFor('winnerCount')];

function textInputFor<K extends keyof z.infer<typeof LotterySchema>>(key: K) {
  return {
    type: 4,
    custom_id: key,
    style: 1,
    label: LotterySchema.shape[key].description,
  };
}

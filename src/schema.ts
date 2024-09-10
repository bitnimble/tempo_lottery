import z from 'zod';

export const enum LotteryType {
  SIMPLE = 'SIMPLE',
  LOWEST_UNIQUE_NUMBER = 'LOWEST_UNIQUE_NUMBER',
}

export const LotterySchema = z.object({
  id: z.string().uuid(),
  title: z.string({ description: 'Lottery title' }),
  lotteryType: z.enum([LotteryType.SIMPLE, LotteryType.LOWEST_UNIQUE_NUMBER], {
    description: 'Lottery type',
  }),
  description: z.string({ description: 'Description' }),
  banner: z.string({ description: 'Banner image (URL)' }).optional(),
  prize: z.string({ description: 'Prize' }),
  host: z.string({ description: 'Host' }),
  roles: z.array(z.string(), {
    description: 'Required Discord roles needed to participate (one per line)',
  }),
  startAt: z.date({ description: 'Date and time to start at (ISO8601 format)' }),
  duration: z.number({ description: 'Duration of the lottery, in minutes' }).min(1),
  repeatInterval: z.number({ description: 'How often this lottery repeats, in minutes' }),
  winnerCount: z.number({ description: 'Maximum number of winners' }).min(1),
});

export type Lottery = z.infer<typeof LotterySchema>;

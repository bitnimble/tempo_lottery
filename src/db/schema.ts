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
    description: 'Discord roles (one per line) needed to join',
  }),
  startAt: z
    .string({ description: 'Date and time to start at (ISO8601 format)' })
    .datetime({ offset: true }),
  duration: z.number({ description: 'Duration of the lottery, in milliseconds' }).min(1),
  repeatInterval: z.number({ description: 'How often this lottery repeats, in milliseconds' }),
  winnerCount: z.number({ description: 'Maximum number of winners' }).min(1),
  minimumBid: z.number({ description: 'Minimum possible bid number' }).default(1),
  maximumBid: z.number({ description: 'Maximum possible bid number ' }).default(1000),
});

export const DraftLotterySchema = LotterySchema.partial().merge(
  z.object({
    id: z.string().uuid(),
  })
);

export type DraftLottery = z.infer<typeof DraftLotterySchema>;
export type Lottery = z.infer<typeof LotterySchema>;

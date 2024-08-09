import z from 'zod';

export const enum LotteryType {
  SIMPLE = 'SIMPLE',
  LOWEST_UNIQUE_NUMBER = 'LOWEST_UNIQUE_NUMBER',
}

export const Lottery = z.object({
  title: z.string(),
  type: z.enum([LotteryType.SIMPLE, LotteryType.LOWEST_UNIQUE_NUMBER]),
  description: z.string(),
  banner: z.string({ description: 'An optional banner image for the lottery post' }).optional(),
  prize: z.string(),
  host: z.string({ description: "The host's Discord ID" }),
  roles: z.array(z.string(), { description: 'Required Discord roles needed to participate' }),
  startAt: z.date(),
  duration: z.number({ description: 'Duration of the lottery, in minutes' }).min(1),
  repeat: z.number({ description: 'How often this lottery repeats, in minutes' }),
  winnerCount: z.number().min(1),
});

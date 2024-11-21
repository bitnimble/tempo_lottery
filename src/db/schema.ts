import z from 'zod';

export const enum LotteryType {
  SIMPLE = 'SIMPLE',
  LOWEST_UNIQUE_NUMBER = 'LOWEST_UNIQUE_NUMBER',
}

export const lotteryTypeLabels: Record<LotteryType, string> = {
  [LotteryType.SIMPLE]: 'Simple',
  [LotteryType.LOWEST_UNIQUE_NUMBER]: 'Lowest unique number',
};

export const BidSchema = z.object({
  id: z.string().uuid(),
  user: z.string({ description: 'Discord ID of the user who placed this bid' }),
  bid: z.number({ description: 'Bidding number' }),
  placedAt: z.string({ description: 'Date and time this bid was placed' }),
});

export const LotterySchema = z.object({
  id: z.string().uuid(),
  title: z.string({ description: 'Lottery title' }).default('New lottery'),
  lotteryType: z
    .enum([LotteryType.SIMPLE, LotteryType.LOWEST_UNIQUE_NUMBER], {
      description: 'Lottery type',
    })
    .default(LotteryType.SIMPLE),
  description: z.string({ description: 'Description' }).optional(),
  banner: z.string({ description: 'Banner image (URL)' }).optional(),
  prize: z.string({ description: 'Prize description' }).optional(),
  creator: z.string({
    description: 'Discord ID of the user who is credit with creating this lottery',
  }),
  adminCreator: z.string({
    description:
      'Discord ID of the lottery admin user who actually created this lottery. This is never shown to the public and is only for logging purposes.',
  }),
  channel: z.string({
    description: 'Discord channel ID for the channel where the draw results will be posted',
  }),
  roles: z
    .array(z.string(), {
      description: 'Discord roles (one per line) needed to join',
    })
    .optional(),
  startAt: z
    .string({ description: 'Date and time to start at (ISO8601 format, in UTC)' })
    .datetime({ offset: true }),
  duration: z
    .number({ description: 'How long the lottery is open for, in milliseconds' })
    .min(1)
    .default(7 * 24 * 60 * 60 * 1000), // Defaults to 1 week
  repeatInterval: z
    .number({
      description:
        'How often this lottery repeats, in milliseconds. Repeat interval must be greater than the lottery duration.',
    })
    .default(0),
  winnerCount: z.number({ description: 'Maximum number of winners' }).min(1).default(1),
  minimumBid: z.number({ description: 'Minimum possible bid number' }).default(1),
  maximumBid: z.number({ description: 'Maximum possible bid number ' }).default(1000),
  maxBidsPerUser: z
    .number({ description: 'Maximum number of bids a single user can make' })
    .default(1),
  bids: z.array(BidSchema).default([]),
  isAnnounced: z
    .boolean({
      description:
        'Whether this lottery has been opened and has been announced in the Discord channel',
    })
    .default(false),
});

export type Bid = z.infer<typeof BidSchema>;
export type Lottery = z.infer<typeof LotterySchema>;

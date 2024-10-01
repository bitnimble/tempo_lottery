// Hacky way to run singletons on server start. See
// https://github.com/vercel/next.js/discussions/15341 for more details.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    import('@/app/load_discord/discord_installer').then((i) => i.installDiscordBot());
  }
}

import TerserPlugin from 'terser-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  i18n: {
    locales: ['en', 'en-AU', 'en-US'],
    defaultLocale: 'en-AU',
  },
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.node/,
      use: 'node-loader',
    });
    config.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            // Discord.js uses class names to register action handlers at runtime, so we can't mangle them.
            // https://github.com/discordjs/discord.js/blob/98153baf913195e5510240bd0763d4142c06fcff/packages/discord.js/src/client/actions/ActionsManager.js#L80
            keep_classnames: true,
          },
        }),
      ]
    };

    return config;
  },
};

export default nextConfig;

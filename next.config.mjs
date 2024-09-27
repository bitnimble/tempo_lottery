/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'en-AU', 'en-US'],
    defaultLocale: 'en-AU',
  },
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.node/,
      use: 'node-loader',
    });

    return config;
  },
};

export default nextConfig;

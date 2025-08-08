const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Keep html2canvas disabled for web
  config.resolve.alias = {
    ...config.resolve.alias,
    'html2canvas': false,
  };

  // Add fallbacks for Node.js modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    util: require.resolve('util'),
    url: require.resolve('url'),
    assert: require.resolve('assert'),
    process: require.resolve('process/browser'),
    fs: false,
    net: false,
    tls: false,
  };

  return config;
};
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Remove Supabase from webpack processing since we're using custom implementation
  config.resolve.alias = {
    ...config.resolve.alias,
    '@supabase/supabase-js': false,
    '@supabase/postgrest-js': false,
    '@supabase/realtime-js': false,
    '@supabase/storage-js': false,
    '@supabase/gotrue-js': false,
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
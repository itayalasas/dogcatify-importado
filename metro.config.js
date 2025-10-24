const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

const config = getDefaultConfig(__dirname);

// Enable web support
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Ensure proper module resolution
config.resolver.alias = {
  '@': path.resolve(__dirname, './'),
};

config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add specific resolution for problematic modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Configure transformer for better compatibility
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer.minifierConfig,
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
  assetPlugins: ['expo-asset/tools/hashAssetFiles'],
};

// Improve resolver configuration
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// Configure watchFolders properly
config.watchFolders = [path.resolve(__dirname)];

// Ensure Metro can handle all file types
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'bin',
  'txt',
  'jpg',
  'png',
  'json',
];

module.exports = withSentryConfig(config);
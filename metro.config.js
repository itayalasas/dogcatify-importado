const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable web support
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Ensure proper module resolution
config.resolver.alias = {
  '@': __dirname,
};

config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add specific resolution for Supabase modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Configure jsPDF to use browser version
config.resolver.alias = {
  ...config.resolver.alias,
  'jspdf': path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.min.js'),
  'html2canvas': path.resolve(__dirname, 'src/mocks/html2canvas.js'),
};

// Ensure Metro can find all dependencies
config.watchFolders = [__dirname];

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

// Improve caching
config.resetCache = true;

// Configure for better mobile performance
config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: () => [
    require.resolve('react-native/Libraries/Core/InitializeCore'),
  ],
};

module.exports = config;
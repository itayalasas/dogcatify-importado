module.exports = function(api) {
  const isProduction = api.env('production');
  api.cache.using(() => isProduction);

  const plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './',
        },
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.native.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.native.tsx',
          '.tsx',
          '.js',
          '.jsx',
          '.json',
        ],
      },
    ],
  ];

  if (isProduction) {
    // Strip console.log/info/debug from production bundles; keep warn/error
    // so real issues are still visible in device logs and Sentry breadcrumbs.
    plugins.push(['transform-remove-console', { exclude: ['warn', 'error'] }]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
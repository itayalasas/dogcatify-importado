module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            'html2canvas': './src/mocks/html2canvas.js',
            'jspdf': 'jspdf/dist/jspdf.min.js'
          }
        }
      ]
    ],
  };
};
const { withAndroidManifest } = require('expo/config-plugins');

// Android 11+ (API 30+) package visibility: without declaring the
// Mercado Pago package/scheme in <queries>, Linking.canOpenURL() for
// 'mercadopago://' silently returns false even when the app is installed
// — same root cause as the iOS LSApplicationQueriesSchemes fix, different
// mechanism. This is what utils/mercadoPago.ts's isMercadoPagoAppInstalled()
// relies on to offer the "open in app vs. browser" choice during checkout.
const MERCADOPAGO_PACKAGE = 'com.mercadopago.wallet';
const MERCADOPAGO_SCHEME = 'mercadopago';

function withMercadoPagoQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];

    if (!queries.package) {
      queries.package = [];
    }
    const hasPackage = queries.package.some(
      (p) => p.$?.['android:name'] === MERCADOPAGO_PACKAGE
    );
    if (!hasPackage) {
      queries.package.push({ $: { 'android:name': MERCADOPAGO_PACKAGE } });
    }

    if (!queries.intent) {
      queries.intent = [];
    }
    const hasSchemeIntent = queries.intent.some((intent) =>
      intent.data?.some((d) => d.$?.['android:scheme'] === MERCADOPAGO_SCHEME)
    );
    if (!hasSchemeIntent) {
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': MERCADOPAGO_SCHEME } }],
      });
    }

    return config;
  });
}

module.exports = withMercadoPagoQueries;

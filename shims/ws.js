// Metro/Webpack shim for the Node-only `ws` package.
// Supabase Realtime only reaches this path when WebSocket is unavailable,
// but Expo still tries to bundle the dependency tree unless we alias it.
module.exports = globalThis.WebSocket || class WebSocketShim {
  constructor() {
    throw new Error('WebSocket shim should not be instantiated in Expo native bundles.');
  }
};

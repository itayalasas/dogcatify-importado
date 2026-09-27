// jest-expo's own setup.js unconditionally runs `require('expo/src/winter')`,
// which triggers `ExpoFetchModule.ts`'s `requireNativeModule('ExpoFetchModule')`.
// jest-expo tries to auto-mock that via a stack-trace-based directory walk
// (`attemptLookup` in jest-expo/src/preset/setup.js) that assumes it can always
// find a `package.json` while walking up from the caller's file path. On some
// environments that walk fails and throws `TypeError: The "path" argument must
// be of type string. Received null` before jest-expo's own fallback stub
// (`globalThis.expo.modules.ExpoFetchModule`, a few lines below in the same
// file) ever gets a chance to run — crashing every test suite regardless of
// what it actually imports.
//
// This file must run BEFORE jest-expo/src/preset/setup.js (see the
// "setupFiles" order in package.json) so this mock is already registered by
// the time that file's `require('expo/src/winter')` resolves ExpoFetchModule,
// short-circuiting the fragile lookup entirely. The stub mirrors the shape
// jest-expo itself falls back to (NativeRequest/NativeResponse no-op classes).
jest.doMock('expo/src/winter/fetch/ExpoFetchModule', () => ({
  ExpoFetchModule: {
    NativeRequest: class {
      start() {}
      cancel() {}
    },
    NativeResponse: class {
      startStreaming() {}
      cancelStreaming() {}
      arrayBuffer() {}
      text() {}
    },
  },
}));

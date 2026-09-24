// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // eslint-config-expo's SDK 57 update turned on the new React Compiler
    // rule set (react-hooks/*) as errors by default. This is a large,
    // pre-existing codebase that predates React Compiler and was never
    // written against these rules, so they fire ~330 times across
    // long-standing, working patterns (e.g. Animated.Value refs read
    // directly in render, a standard and safe React Native idiom these
    // rules can't distinguish from an unsafe DOM ref read). Retrofitting
    // the whole app for React Compiler compatibility is a separate,
    // dedicated effort — keep the findings visible as warnings (so they
    // don't silently disappear) without blocking the CI gate on an
    // unrelated migration.
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

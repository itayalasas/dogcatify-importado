#!/usr/bin/env node

const { spawn } = require('node:child_process');

// Expo CLI dependency validation can fail on newer Node/undici combinations.
// Keep Metro startup reliable by disabling only this validation step.
process.env.EXPO_NO_DEPENDENCY_VALIDATION = process.env.EXPO_NO_DEPENDENCY_VALIDATION || '1';

const expoCli = require.resolve('expo/bin/cli');
const args = process.argv.slice(2);
const child = spawn(process.execPath, [expoCli, 'start', ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

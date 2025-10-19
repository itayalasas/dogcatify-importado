#!/usr/bin/env bash
set -euo pipefail

echo "📦 Running pre-install hook..."
echo "Platform: ${EAS_BUILD_PLATFORM:-unknown}"
echo "Profile: ${EAS_BUILD_PROFILE:-unknown}"

if [[ "${EAS_BUILD_PLATFORM:-}" == "ios" ]]; then
  echo "🧰 Running iOS setup..."
  gem install cocoapods -N || true
fi

if [[ "${EAS_BUILD_PLATFORM:-}" == "android" ]]; then
  echo "🤖 Running Android setup..."
fi

echo "✅ Pre-install hook finished."


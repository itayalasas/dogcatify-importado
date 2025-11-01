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

  # Configurar Datadog para el build
  echo "📊 Configuring Datadog..."

  # Exportar variables de entorno para Datadog
  export DD_API_KEY="${DD_API_KEY:-068208a98b131a96831ca92a86d4f158}"
  export DATADOG_API_KEY="${DATADOG_API_KEY:-068208a98b131a96831ca92a86d4f158}"
  export DD_SITE="${DD_SITE:-us5.datadoghq.com}"
  export DATADOG_SITE="${DATADOG_SITE:-us5.datadoghq.com}"

  echo "   DD_API_KEY: ${DD_API_KEY:0:10}..."
  echo "   DD_SITE: ${DD_SITE}"

  # Crear archivo .datadogrc si no existe
  if [[ ! -f ".datadogrc" ]]; then
    echo "   Creating .datadogrc configuration file..."
    cat > .datadogrc << EOF
{
  "apiKey": "${DD_API_KEY}",
  "datadogSite": "${DD_SITE}"
}
EOF
  fi

  echo "✅ Datadog configured successfully"
fi

echo "✅ Pre-install hook finished."


#!/usr/bin/env bash
set -euo pipefail
echo "== E.V CHINA GLOBAL setup =="
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 20 LTS from https://nodejs.org/"
  exit 1
fi
npm install
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local. Add your API key and WhatsApp number before enabling live services."
fi
echo "Setup complete. Start the development server with: npm run dev"

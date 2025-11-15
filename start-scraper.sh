#!/bin/bash

# Web-to-Figma Scraper Startup Script
set -euo pipefail

echo "==================== WEB-TO-FIGMA SCRAPER ===================="
echo ""
echo "Starting scraper server with comprehensive logging..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRAPER_DIR="${SCRIPT_DIR}/scraper"

if [ ! -d "${SCRAPER_DIR}" ]; then
  echo "❌ Could not find scraper directory at ${SCRAPER_DIR}" >&2
  exit 1
fi

cd "${SCRAPER_DIR}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Running npm install..."
  npm install
fi

# Build the project
echo "📦 Building TypeScript..."
npm run build

echo "✅ Build successful!"
echo ""
echo "🚀 Starting scraper server..."
echo ""
echo "Server will be available at:"
echo "  - HTTP: http://localhost:3000"
echo "  - WebSocket: ws://localhost:3000/ws"
echo ""
echo "Endpoints:"
echo "  - GET  /health          - Health check"
echo "  - GET  /screenshot?url= - Capture screenshot"
echo "  - WS   /ws              - WebSocket streaming"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=============================================================="
echo ""

# Start the server with detailed logging
npm start

#!/bin/bash

# Web-to-Figma Scraper Startup Script
echo "==================== WEB-TO-FIGMA SCRAPER ===================="
echo ""
echo "Starting scraper server with comprehensive logging..."
echo ""

# Navigate to scraper directory
cd /Users/skirk92/projects/web/scraper

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Running npm install..."
  npm install
fi

# Build the project
echo "📦 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed! Fix TypeScript errors before starting."
  exit 1
fi

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

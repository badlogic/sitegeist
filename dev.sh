#!/bin/bash

# Start all development servers for sitegeist and its dependencies
# Usage: ./dev.sh

set -e

echo "🚀 Starting development servers..."
echo ""

# Check if required directory exists
if [ ! -d "../pi-mono" ]; then
    echo "❌ Error: pi-mono not found at ../pi-mono"
    exit 1
fi

# Kill all child processes on exit
trap 'echo ""; echo "🛑 Stopping all dev servers..."; kill 0' EXIT INT TERM

# Start dev servers
echo "🤖 Starting pi-mono dev server..."
(cd ../pi-mono && npm run dev) &
PI_MONO_PID=$!

# Wait a moment for dependencies to start building
sleep 2

echo "🌐 Starting sitegeist dev server..."
npm run dev &
SITEGEIST_PID=$!

echo ""
echo "✅ All dev servers started!"
echo "   - pi-mono: PID $PI_MONO_PID"
echo "   - sitegeist: PID $SITEGEIST_PID"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for all background jobs
wait

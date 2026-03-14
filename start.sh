#!/bin/bash
# Start script for Freelance AI Bot

cd "$(dirname "$0")"

# Source bashrc for bun
source ~/.bashrc 2>/dev/null || true
export PATH="$HOME/.bun/bin:$PATH"

echo "🤖 Starting Freelance AI Bot..."
echo "Press Ctrl+C to stop"
echo ""

bun run dev

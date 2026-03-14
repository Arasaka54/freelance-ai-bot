#!/bin/bash
# Installation script for Freelance AI Bot

set -e

echo "🤖 Freelance AI Bot Installer"
echo "=============================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  Please run as root: sudo ./setup.sh"
    exit 1
fi

# Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
apt install -y curl git nano

# Install Bun if not installed
if ! command -v bun &> /dev/null; then
    echo "🚀 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
else
    echo "✅ Bun already installed"
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

# Install dependencies
echo "📦 Installing npm dependencies..."
bun install

# Create .env from example if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file and add your Telegram bot token!"
    echo "   nano .env"
    echo ""
fi

# Make start script executable
chmod +x start.sh

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your bot token:"
echo "   nano .env"
echo ""
echo "2. Start the bot:"
echo "   ./start.sh"
echo ""
echo "3. For auto-start on boot, run:"
echo "   ./install-service.sh"

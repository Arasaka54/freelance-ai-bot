#!/bin/bash
# Install as systemd service

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUN_PATH="$HOME/.bun/bin/bun"

# Create service file
cat > /etc/systemd/system/freelance-bot.service << EOF
[Unit]
Description=Freelance AI Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$SCRIPT_DIR
ExecStart=$BUN_PATH run index.ts
Restart=always
RestartSec=10
Environment=PATH=/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable freelance-bot
systemctl start freelance-bot

echo "✅ Service installed and started!"
echo ""
echo "Commands:"
echo "  Status:  sudo systemctl status freelance-bot"
echo "  Logs:    journalctl -u freelance-bot -f"
echo "  Stop:    sudo systemctl stop freelance-bot"
echo "  Restart: sudo systemctl restart freelance-bot"

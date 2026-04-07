#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/erb-fuel-monitor"
SYSTEMD_DIR="/etc/systemd/system"

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "Project directory not found: $PROJECT_DIR"
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo ".env file not found at $PROJECT_DIR/.env"
  exit 1
fi

sudo cp "$PROJECT_DIR/deploy/systemd/erb-worker.service" "$SYSTEMD_DIR/erb-worker.service"
sudo cp "$PROJECT_DIR/deploy/systemd/erb-api.service" "$SYSTEMD_DIR/erb-api.service"

sudo systemctl daemon-reload
sudo systemctl enable erb-worker.service
sudo systemctl enable erb-api.service
sudo systemctl restart erb-worker.service
sudo systemctl restart erb-api.service

echo "Services installed and started."
echo "Check status with:"
echo "  sudo systemctl status erb-worker.service"
echo "  sudo systemctl status erb-api.service"
echo "Check logs with:"
echo "  sudo journalctl -u erb-worker.service -f"
echo "  sudo journalctl -u erb-api.service -f"

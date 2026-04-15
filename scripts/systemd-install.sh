#!/usr/bin/env bash
# Install NightShift as a systemd service on a DigitalOcean VPS.
# Usage: sudo ./scripts/systemd-install.sh /opt/nightshift

set -euo pipefail

TARGET_DIR=${1:-/opt/nightshift}
SERVICE_NAME=nightshift
USER_NAME=${SUDO_USER:-$(whoami)}

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "target dir $TARGET_DIR does not exist; clone the project there first." >&2
  exit 1
fi

cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=NightShift Autonomous Build System
After=network.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${TARGET_DIR}
EnvironmentFile=${TARGET_DIR}/.env
ExecStart=/usr/bin/env node ${TARGET_DIR}/dist/index.js daemon
Restart=on-failure
RestartSec=5
StandardOutput=append:${TARGET_DIR}/state/nightshift.log
StandardError=append:${TARGET_DIR}/state/nightshift.err

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}
systemctl status ${SERVICE_NAME} --no-pager

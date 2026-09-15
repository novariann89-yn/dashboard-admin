#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Build ulang =="
npm run build

echo "== Hentikan server lama =="
pkill -f "[s]erve-lan" 2>/dev/null || true

if [[ "${1:-}" == "--detach" ]]; then
  LOG_FILE="${TMPDIR:-/tmp}/toko-mas-andik.log"
  echo "== Start server (background) =="
  setsid bash -c "npm run lan > \"$LOG_FILE\" 2>&1" < /dev/null > /dev/null 2>&1 &
  sleep 2
  if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:3000/"; then
    echo "Server jalan."
    echo "Alamat untuk HP: http://$(hostname -I | awk '{print $1}'):3000"
    echo "Log: $LOG_FILE"
    echo "Hentikan dengan: npm run stop"
  else
    echo "Server gagal start. Cek log: $LOG_FILE"
    tail -20 "$LOG_FILE" || true
    exit 1
  fi
else
  echo "== Start server (foreground, Ctrl+C untuk berhenti) =="
  exec npm run lan
fi
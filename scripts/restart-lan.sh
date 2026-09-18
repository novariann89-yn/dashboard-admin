#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Build ulang =="
npm run build

echo "== Siapkan sertifikat (HTTPS) =="
bash scripts/make-cert.sh || true

echo "== Hentikan server lama =="
pkill -f "[s]erve-lan" 2>/dev/null || true

if [[ "${1:-}" == "--detach" ]]; then
  LOG_FILE="${TMPDIR:-/tmp}/toko-mas-andik.log"
  echo "== Start server (background) =="
  setsid bash -c "npm run lan > \"$LOG_FILE\" 2>&1" < /dev/null > /dev/null 2>&1 &
  sleep 2

  PROTO="http"
  CURL_FLAGS="-fsS"
  if [[ -f certs/server.crt && -f certs/server.key ]]; then
    PROTO="https"
    CURL_FLAGS="-kfsS"
  fi

  if curl ${CURL_FLAGS} -o /dev/null --max-time 5 "${PROTO}://127.0.0.1:3000/"; then
    echo "Server jalan."
    echo "Alamat untuk HP: ${PROTO}://$(hostname -I | awk '{print $1}'):3000"
    if [[ "$PROTO" == "http" ]]; then
      echo "Catatan: mode HTTP belum bisa instal offline. Jalankan 'npm run cert' lalu restart."
    else
      echo "Catatan: instal certs/ca.crt di HP sekali supaya HTTPS dipercaya (lihat DEPLOY.md)."
    fi
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
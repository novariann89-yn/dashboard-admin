#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

CERT_DIR="certs"
mkdir -p "$CERT_DIR"

mapfile -t IPS < <(hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)

if [[ ${#IPS[@]} -eq 0 ]]; then
  echo "Tidak menemukan IP LAN." >&2
  exit 1
fi

SAN="DNS:localhost,IP:127.0.0.1"
for ip in "${IPS[@]}"; do
  SAN="$SAN,IP:$ip"
done

CURRENT_IPS="$(printf '%s\n' "${IPS[@]}")"

if [[ -f "$CERT_DIR/server.crt" && -f "$CERT_DIR/ips.txt" && "$(cat "$CERT_DIR/ips.txt")" == "$CURRENT_IPS" ]]; then
  echo "Sertifikat masih berlaku untuk IP: $(printf '%s ' "${IPS[@]}")"
  exit 0
fi

echo "== Membuat sertifikat lokal untuk: $(printf '%s ' "${IPS[@]}") =="

if [[ ! -f "$CERT_DIR/ca.key" ]]; then
  openssl genrsa -out "$CERT_DIR/ca.key" 2048 >/dev/null 2>&1
  openssl req -x509 -new -nodes -key "$CERT_DIR/ca.key" -sha256 -days 3650 \
    -out "$CERT_DIR/ca.crt" -subj "/CN=Dashboard Admin Local CA" >/dev/null 2>&1
  echo "CA lokal dibuat: $CERT_DIR/ca.crt"
fi

openssl genrsa -out "$CERT_DIR/server.key" 2048 >/dev/null 2>&1
openssl req -new -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" \
  -subj "/CN=dashboard-admin.local" >/dev/null 2>&1

openssl x509 -req -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/server.crt" -days 825 -sha256 \
  -extfile <(printf "subjectAltName=%s\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n" "$SAN") \
  >/dev/null 2>&1

rm -f "$CERT_DIR/server.csr"
printf '%s' "$CURRENT_IPS" > "$CERT_DIR/ips.txt"

echo "Sertifikat server dibuat: $CERT_DIR/server.crt"
echo
echo "PENTING: instal '$CERT_DIR/ca.crt' di HP sekali saja (lihat DEPLOY.md)."
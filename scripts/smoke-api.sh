#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://backend-amiweb.vercel.app}"

echo "Smoke target: $BASE_URL"

check_json() {
  local url="$1"
  local expected="$2"
  local code
  code=$(curl -sS -o /tmp/smoke.out -w "%{http_code}" "$url")
  echo "$url -> $code"
  if [[ "$code" != "$expected" ]]; then
    echo "Expected $expected but got $code"
    cat /tmp/smoke.out
    exit 1
  fi
}

check_json "$BASE_URL/api/health" "200"
check_json "$BASE_URL/api/ready" "200"
check_json "$BASE_URL/api/v1/health" "200"
check_json "$BASE_URL/api/auth/me" "401"
check_json "$BASE_URL/api/products" "200"
check_json "$BASE_URL/api/search?q=reactivo&limit=5" "200"

echo "Checking CORS preflight..."
preflight_code=$(curl -sS -o /tmp/smoke_opt.out -w "%{http_code}" -X OPTIONS "$BASE_URL/api/products" \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: content-type,authorization')
echo "OPTIONS /api/products -> $preflight_code"
if [[ "$preflight_code" != "204" ]]; then
  echo "Expected preflight 204"
  cat /tmp/smoke_opt.out
  exit 1
fi

echo "Smoke OK"

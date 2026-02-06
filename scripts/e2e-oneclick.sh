#!/usr/bin/env bash
set -euo pipefail

# One-click e2e runner for macOS terminals (zsh default).
# Creates a driver session, then runs Trips e2e flow.

GATEWAY_URL="${GATEWAY_URL:-http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
DRIVER_PHONE="${DRIVER_PHONE:-}"
DRIVER_PASSWORD="${DRIVER_PASSWORD:-}"
RIDER_PHONE="${RIDER_PHONE:-}"
RIDER_PASSWORD="${RIDER_PASSWORD:-}"
TRIP_PIN="${TRIP_PIN:-}"
REDIS_URL="${REDIS_URL:-}"
DRIVER_SESSIONS_REDIS_URL="${DRIVER_SESSIONS_REDIS_URL:-}"

die() {
  echo "ERROR: $1" >&2
  exit 1
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"
}

require_tool curl
require_tool jq
require_tool node
require_tool npm
require_tool uuidgen

[[ -n "$ADMIN_EMAIL" ]] || die "ADMIN_EMAIL es requerido."
[[ -n "$ADMIN_PASSWORD" ]] || die "ADMIN_PASSWORD es requerido."
[[ -n "$DRIVER_PHONE" ]] || die "DRIVER_PHONE es requerido."
[[ -n "$DRIVER_PASSWORD" ]] || die "DRIVER_PASSWORD es requerido."

CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GATEWAY_URL}/trips/healthz" || true)
[[ "$CODE" == "200" ]] || die "Gateway not reachable (healthz code=$CODE)."

ADMIN_TOKEN="$(
  curl -s -X POST "${GATEWAY_URL}/auth/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" | jq -r ".access_token"
)"
[[ -n "$ADMIN_TOKEN" && "$ADMIN_TOKEN" != "null" ]] || die "Admin login failed."

device_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
driver_login="$(
  curl -s -X POST "${GATEWAY_URL}/auth/drivers/login" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"${DRIVER_PHONE}\",\"password\":\"${DRIVER_PASSWORD}\",\"device_id\":\"${device_id}\"}"
)"
DRIVER_TOKEN="$(echo "$driver_login" | jq -r ".access_token")"
DRIVER_ID="$(echo "$driver_login" | jq -r ".user.id")"
[[ -n "$DRIVER_TOKEN" && "$DRIVER_TOKEN" != "null" ]] || die "Driver login failed: $driver_login"
[[ -n "$DRIVER_ID" && "$DRIVER_ID" != "null" ]] || die "Driver id missing in login response."

RIDER_TOKEN="$ADMIN_TOKEN"
RIDER_ID="rider-test-$(date +%s)"
if [[ -n "$RIDER_PHONE" && -n "$RIDER_PASSWORD" ]]; then
  rider_device_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  rider_login="$(
    curl -s -X POST "${GATEWAY_URL}/auth/riders/login" \
      -H "Content-Type: application/json" \
      -d "{\"phone\":\"${RIDER_PHONE}\",\"password\":\"${RIDER_PASSWORD}\",\"device_id\":\"${rider_device_id}\"}"
  )"
  RIDER_TOKEN="$(echo "$rider_login" | jq -r ".access_token")"
  RIDER_ID="$(echo "$rider_login" | jq -r ".user.id")"
  [[ -n "$RIDER_TOKEN" && "$RIDER_TOKEN" != "null" ]] || die "Rider login failed: $rider_login"
  [[ -n "$RIDER_ID" && "$RIDER_ID" != "null" ]] || die "Rider id missing in login response."
fi

printf '{"driver_id":"%s","device_id":"%s","token":"%s"}\n' \
  "$DRIVER_ID" "$device_id" "$DRIVER_TOKEN" > /tmp/driver-token.json

mkdir -p /tmp/socket-client
if [[ ! -d /tmp/socket-client/node_modules/socket.io-client ]]; then
  (cd /tmp/socket-client && npm init -y >/dev/null && npm install socket.io-client@4 >/dev/null)
fi

cat >/tmp/socket-client/driver-sim.js <<'JS'
const fs = require('fs');
const { io } = require('socket.io-client');

const { driver_id, device_id, token } = JSON.parse(
  fs.readFileSync('/tmp/driver-token.json', 'utf8')
);

let seq = 1;
const socket = io(process.env.DRIVER_WS_URL, {
  path: '/driver-sessions/socket.io',
  auth: { token },
});

socket.on('connect', () => {
  console.log(`connected: ${socket.id} driver=${driver_id}`);
  socket.emit(
    'driver.join',
    {
      seq: seq++,
      device_id,
      app_version: 'test-1.0.0',
      platform: 'android',
      capabilities: ['loc', 'trip-room'],
    },
    (ack) => {
      console.log('driver.join ack:', ack);
      socket.emit(
        'location.update',
        {
          seq: seq++,
          lat: -17.78345,
          lng: -63.18117,
          accuracy_m: 5,
          heading_deg: 180,
          speed_ms: 0,
          ts_client: new Date().toISOString(),
        },
        (locAck) => {
          console.log('location.update ack:', locAck);
        }
      );
    }
  );
});

setInterval(() => {
  socket.emit('heartbeat', { seq: seq++ });
}, 5000);

socket.on('connect_error', (err) => {
  console.error('connect_error:', err?.message || err);
});

// Keep process alive.
setInterval(() => {}, 10000);
JS

export DRIVER_WS_URL="${GATEWAY_URL}/rt/driver"
node /tmp/socket-client/driver-sim.js > /tmp/driver-sim.log 2>&1 &
SIM_PID=$!
trap "kill $SIM_PID >/dev/null 2>&1 || true" EXIT

sleep 3
tail -n 5 /tmp/driver-sim.log || true

RESP="$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${GATEWAY_URL}/driver-sessions/sessions/${DRIVER_ID}")"
CODE="$(echo "$RESP" | tail -n1)"
BODY="$(echo "$RESP" | sed '$d')"
[[ "$CODE" == "200" ]] || die "Driver session not available (code=$CODE): $BODY"

ONLINE="$(echo "$BODY" | jq -r ".online")"
LASTLOC="$(echo "$BODY" | jq -r ".last_loc")"
[[ "$ONLINE" == "true" && "$LASTLOC" != "null" ]] || die "Driver not online or missing location."

if [[ -z "$REDIS_URL" && -f ".env" ]]; then
  REDIS_URL="$(sed -n 's/^REDIS_URL=//p' .env | head -n1 | tr -d '\"')"
fi

if [[ -n "$REDIS_URL" ]]; then
  PIN="${TRIP_PIN:-1234}"
  RIDER_TOKEN="$RIDER_TOKEN" DRIVER_TOKEN="$DRIVER_TOKEN" \
  RIDER_ID="$RIDER_ID" DRIVER_ID="$DRIVER_ID" \
  REDIS_URL="$REDIS_URL" PIN="$PIN" GATEWAY_URL="$GATEWAY_URL" \
  bash scripts/e2e-real.sh
else
  [[ -n "$TRIP_PIN" ]] || die "TRIP_PIN required when REDIS_URL is not available."
  TRIP_PIN="$TRIP_PIN" DRIVER_ID="$DRIVER_ID" GATEWAY_URL="$GATEWAY_URL" \
  bash ./test-endpoints.sh "$ADMIN_TOKEN"
fi

#!/usr/bin/env bash
set -euo pipefail

# Real E2E flow for Trips. Mock payments is optional and only works with local trips.
#
# Required env:
#   RIDER_TOKEN / RIDER_TOKEN_FILE
#   DRIVER_TOKEN / DRIVER_TOKEN_FILE
#   REDIS_URL (for PIN setup)
#
# Optional env:
#   GATEWAY_URL (default: http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com)
#   TRIPS_BASE_URL (default: $GATEWAY_URL/trips)
#   MOCK_PAYMENTS=1 (starts scripts/mock-payments.js on localhost)
#   MOCK_PAYMENTS_PORT=3007
#   RIDER_ID, DRIVER_ID, CITY, VEHICLE_TYPE, PAYMENT_METHOD
#   ORIGIN_LAT, ORIGIN_LNG, DEST_LAT, DEST_LNG, PIN

GATEWAY_URL="${GATEWAY_URL:-http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com}"
TRIPS_BASE_URL="${TRIPS_BASE_URL:-${GATEWAY_URL}/trips}"
MOCK_PAYMENTS="${MOCK_PAYMENTS:-0}"
MOCK_PAYMENTS_PORT="${MOCK_PAYMENTS_PORT:-3007}"

RIDER_ID="${RIDER_ID:-}"
DRIVER_ID="${DRIVER_ID:-}"
CITY="${CITY:-SCZ}"
VEHICLE_TYPE="${VEHICLE_TYPE:-comfort}"
PAYMENT_METHOD="${PAYMENT_METHOD:-cash}"

ORIGIN_LAT="${ORIGIN_LAT:--17.78345}"
ORIGIN_LNG="${ORIGIN_LNG:--63.18117}"
DEST_LAT="${DEST_LAT:--17.79456}"
DEST_LNG="${DEST_LNG:--63.19234}"
PIN="${PIN:-}"

RIDER_TOKEN="${RIDER_TOKEN:-}"
DRIVER_TOKEN="${DRIVER_TOKEN:-}"
REDIS_URL="${REDIS_URL:-}"

die() {
  echo "ERROR: $1" >&2
  exit 1
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"
}

load_token() {
  local token_var="$1"
  local file_var="$2"
  local token_value="${!token_var}"
  local file_value="${!file_var:-}"

  if [[ -n "$file_value" ]]; then
    token_value="$(tr -d '\n' < "$file_value")"
  fi

  printf '%s' "$token_value"
}

validate_token() {
  local token="$1"
  local label="$2"
  local segments
  segments=$(echo "$token" | awk -F. '{print NF}')
  [[ "$segments" == "3" ]] || die "$label token is invalid (segments=$segments)."
}

request() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local body="${4:-}"

  local auth_args=()
  if [[ -n "$token" ]]; then
    auth_args=(-H "Authorization: Bearer $token")
  fi

  if [[ -n "$body" ]]; then
    curl -sS -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      "${auth_args[@]}" \
      -d "$body" \
      "$url"
  else
    curl -sS -w "\n%{http_code}" -X "$method" \
      "${auth_args[@]}" \
      "$url"
  fi
}

parse_response() {
  local response="$1"
  RESPONSE_CODE="$(echo "$response" | tail -n1)"
  RESPONSE_BODY="$(echo "$response" | sed '$d')"
}

require_tool curl
require_tool jq
require_tool node

RIDER_TOKEN="$(load_token RIDER_TOKEN RIDER_TOKEN_FILE)"
DRIVER_TOKEN="$(load_token DRIVER_TOKEN DRIVER_TOKEN_FILE)"

[[ -n "$RIDER_TOKEN" ]] || die "RIDER_TOKEN or RIDER_TOKEN_FILE is required."
[[ -n "$DRIVER_TOKEN" ]] || die "DRIVER_TOKEN or DRIVER_TOKEN_FILE is required."
[[ -n "$REDIS_URL" ]] || die "REDIS_URL is required for PIN setup."
[[ -n "$RIDER_ID" ]] || die "RIDER_ID is required."
[[ -n "$DRIVER_ID" ]] || die "DRIVER_ID is required."
[[ -n "$PIN" ]] || die "PIN is required."

validate_token "$RIDER_TOKEN" "RIDER"
validate_token "$DRIVER_TOKEN" "DRIVER"

MOCK_PID=""
cleanup() {
  if [[ -n "$MOCK_PID" ]]; then
    kill "$MOCK_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$MOCK_PAYMENTS" == "1" ]]; then
  if [[ "$TRIPS_BASE_URL" != http://localhost* && "$TRIPS_BASE_URL" != http://127.0.0.1* ]]; then
    echo "MOCK_PAYMENTS=1 only works with a local Trips instance."
    echo "Start Trips locally with PAYMENTS_SERVICE_URL=http://localhost:${MOCK_PAYMENTS_PORT}"
    exit 1
  fi
  MOCK_PAYMENTS_PORT="$MOCK_PAYMENTS_PORT" node scripts/mock-payments.js >/tmp/mock-payments.log 2>&1 &
  MOCK_PID="$!"
  sleep 1
fi

echo "=== healthz ==="
response="$(request GET "${TRIPS_BASE_URL}/healthz")"
parse_response "$response"
echo "$RESPONSE_BODY"
[[ "$RESPONSE_CODE" == "200" ]] || die "Healthz failed (code=$RESPONSE_CODE)"

payload=$(cat <<JSON
{"riderId":"${RIDER_ID}","vehicleType":"${VEHICLE_TYPE}","city":"${CITY}","payment_method":"${PAYMENT_METHOD}","originLat":${ORIGIN_LAT},"originLng":${ORIGIN_LNG},"destLat":${DEST_LAT},"destLng":${DEST_LNG}}
JSON
)

echo "=== create ==="
response="$(request POST "${TRIPS_BASE_URL}" "$RIDER_TOKEN" "$payload")"
parse_response "$response"
echo "$RESPONSE_BODY" | jq
[[ "$RESPONSE_CODE" == "201" ]] || die "Create failed (code=$RESPONSE_CODE)"
TRIP_ID="$(echo "$RESPONSE_BODY" | jq -r '.id')"
[[ -n "$TRIP_ID" && "$TRIP_ID" != "null" ]] || die "Missing trip id"

echo "=== accept ==="
response="$(request PATCH "${TRIPS_BASE_URL}/${TRIP_ID}/accept" "$DRIVER_TOKEN" "{\"driverId\":\"${DRIVER_ID}\"}")"
parse_response "$response"
echo "$RESPONSE_BODY" | jq
[[ "$RESPONSE_CODE" == "200" ]] || die "Accept failed (code=$RESPONSE_CODE)"

echo "=== pin ==="
REDIS_URL="$REDIS_URL" node scripts/set-trip-pin.js "$TRIP_ID" "$PIN"

echo "=== verify ==="
response="$(request POST "${TRIPS_BASE_URL}/${TRIP_ID}/pin/verify" "$RIDER_TOKEN" "{\"pin\":\"${PIN}\"}")"
parse_response "$response"
echo "$RESPONSE_BODY" | jq
[[ "$RESPONSE_CODE" == "200" ]] || die "Verify failed (code=$RESPONSE_CODE)"

echo "=== start ==="
response="$(request PATCH "${TRIPS_BASE_URL}/${TRIP_ID}/start" "$DRIVER_TOKEN")"
parse_response "$response"
echo "$RESPONSE_BODY" | jq
[[ "$RESPONSE_CODE" == "200" ]] || die "Start failed (code=$RESPONSE_CODE)"

echo "=== complete ==="
response="$(request PATCH "${TRIPS_BASE_URL}/${TRIP_ID}/complete" "$DRIVER_TOKEN" "{\"distance_m_final\":3200,\"duration_s_final\":380}")"
parse_response "$response"
echo "$RESPONSE_BODY" | jq
[[ "$RESPONSE_CODE" == "200" ]] || die "Complete failed (code=$RESPONSE_CODE)"

echo "OK: Trip flow completed successfully"

#!/bin/bash
set -euo pipefail

###############################################################################
# test-endpoints.sh
# Script de testing automatizado para MS04-TRIPS en producción
#
# Este script prueba todos los endpoints del microservicio TRIPS siguiendo
# el flujo completo del ciclo de vida de un viaje:
# 1. Health checks
# 2. Create trip
# 3. Accept trip
# 4. Verify PIN
# 5. Start trip
# 6. Complete trip
# 7. Cancel trip (alternativo)
#
# PREREQUISITOS:
# - jq instalado (brew install jq en macOS)
# - JWT token válido de MS02-AUTH
#
# Uso:
#   ./test-endpoints.sh <JWT_TOKEN>
#
# Variables opcionales:
#   GATEWAY_URL - Override del gateway
#   DRIVER_ID   - Driver a usar para aceptar
#   TRIP_PIN    - PIN real del viaje (para verify/start/complete)
#
# Ejemplo:
#   ./test-endpoints.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
###############################################################################

# =============================================================================
# Colores para output
# =============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Configuración
# =============================================================================
GATEWAY_URL="${GATEWAY_URL:-http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com}"
BASE_URL="${GATEWAY_URL}/trips"
JWT_TOKEN="${1:-}"

# Datos de prueba
RIDER_ID="rider-test-$(date +%s)"
DRIVER_ID=""
TRIP_ID=""
TRIP_ACCEPTED=0
PIN_VERIFIED=0

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

# =============================================================================
# Funciones helper
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}=============================================="
    echo -e "$1"
    echo -e "===============================================${NC}"
    echo ""
}

print_test() {
    echo -e "${BLUE}TEST:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_error() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ️  INFO:${NC} $1"
}

# Verificar dependencias
check_dependencies() {
    if ! command -v jq &> /dev/null; then
        print_error "jq no está instalado. Instálalo con: brew install jq"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        print_error "curl no está instalado"
        exit 1
    fi
}

# Verificar JWT token
check_jwt() {
    if [[ -z "$JWT_TOKEN" ]]; then
        print_error "JWT token no proporcionado"
        echo ""
        echo "Uso: $0 <JWT_TOKEN>"
        echo ""
        echo "Ejemplo:"
        echo "  $0 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        echo ""
        exit 1
    fi

    print_info "JWT Token configurado: ${JWT_TOKEN:0:20}..."
}

resolve_driver_id() {
    if [[ -n "$DRIVER_ID" ]]; then
        return
    fi

    if [[ -f "/tmp/driver-token.json" ]]; then
        DRIVER_ID=$(jq -r '.driver_id // empty' /tmp/driver-token.json)
    fi

    if [[ -z "$DRIVER_ID" ]]; then
        DRIVER_ID="driver-67890"
    fi
}

# =============================================================================
# Tests de Health Checks
# =============================================================================

test_health_public() {
    print_test "Health check público (sin autenticación)"

    RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/healthz")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "200" ]]; then
        print_success "Health check público respondió 200 OK"
        print_info "Response: $BODY"
    else
        print_error "Health check falló con código $HTTP_CODE"
        echo "$BODY"
    fi
}

test_health_database() {
    print_test "Health check con verificación de base de datos"

    RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "200" ]]; then
        STATUS=$(echo "$BODY" | jq -r '.status // empty')
        DB_STATUS=$(echo "$BODY" | jq -r '.info.database.status // empty')

        if [[ "$STATUS" == "ok" ]] && [[ "$DB_STATUS" == "up" ]]; then
            print_success "Database health check: OK"
        else
            print_error "Database no está saludable: status=$STATUS, db=$DB_STATUS"
        fi
    else
        print_error "Health check falló con código $HTTP_CODE"
        echo "$BODY"
    fi
}

# =============================================================================
# Test: Create Trip
# =============================================================================

test_create_trip() {
    print_test "Crear nuevo viaje (POST /trips)"

    REQUEST_BODY='{
        "riderId": "'"$RIDER_ID"'",
        "vehicleType": "comfort",
        "city": "SCZ",
        "payment_method": "cash",
        "originLat": -17.78345,
        "originLng": -63.18117,
        "originH3Res9": "898b221a42fffff",
        "destLat": -17.79456,
        "destLng": -63.19234,
        "destH3Res9": "898b22c4b63ffff"
    }'

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d "$REQUEST_BODY" \
        "${BASE_URL}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "201" ]]; then
        TRIP_ID=$(echo "$BODY" | jq -r '.id // empty')
        STATUS=$(echo "$BODY" | jq -r '.status // empty')
        ESTIMATE=$(echo "$BODY" | jq -r '.estimateTotal // empty')
        QUOTE_ID=$(echo "$BODY" | jq -r '.quoteId // empty')

        if [[ -n "$TRIP_ID" ]] && [[ "$STATUS" == "REQUESTED" ]]; then
            print_success "Trip creado exitosamente: $TRIP_ID"
            print_info "Status: $STATUS"
            print_info "Estimate Total: \$$ESTIMATE"
            print_info "Quote ID: $QUOTE_ID"
            echo "$BODY" | jq '.'
        else
            print_error "Response inválido: $BODY"
        fi
    else
        print_error "Create trip falló con código $HTTP_CODE"
        echo "$BODY"
    fi
}

# =============================================================================
# Test: Accept Trip
# =============================================================================

test_accept_trip() {
    if [[ -z "$TRIP_ID" ]]; then
        print_warning "Trip ID no disponible, saltando test de accept"
        return
    fi

    print_test "Aceptar viaje (PATCH /trips/$TRIP_ID/accept)"

    REQUEST_BODY='{
        "driverId": "'"$DRIVER_ID"'"
    }'

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X PATCH \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d "$REQUEST_BODY" \
        "${BASE_URL}/${TRIP_ID}/accept")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "200" ]]; then
        STATUS=$(echo "$BODY" | jq -r '.status // empty')
        DRIVER=$(echo "$BODY" | jq -r '.driverId // empty')

        if [[ "$STATUS" == "ASSIGNED" ]] && [[ "$DRIVER" == "$DRIVER_ID" ]]; then
            print_success "Trip aceptado por driver: $DRIVER"
            TRIP_ACCEPTED=1
            echo "$BODY" | jq '.'
        else
            print_error "Response inválido: $BODY"
        fi
    else
        print_error "Accept trip falló con código $HTTP_CODE"
        echo "$BODY"

        # Si falla por driver no online, es esperado en testing
        if echo "$BODY" | grep -q "not online"; then
            print_warning "Driver no está online en MS03-DRIVER-SESSIONS (esperado en testing)"
        fi
    fi
}

# =============================================================================
# Test: Verify PIN
# =============================================================================

test_verify_pin() {
    if [[ -z "$TRIP_ID" ]] || [[ "$TRIP_ACCEPTED" -ne 1 ]]; then
        print_warning "Trip ID no disponible, saltando test de verify PIN"
        return
    fi

    if [[ -z "${TRIP_PIN:-}" ]]; then
        print_warning "TRIP_PIN no configurado; no se intentará verificar para evitar bloqueos"
        return
    fi

    print_test "Verificar PIN (POST /trips/$TRIP_ID/pin/verify)"

    REQUEST_BODY='{
        "pin": "'"$TRIP_PIN"'"
    }'

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d "$REQUEST_BODY" \
        "${BASE_URL}/${TRIP_ID}/pin/verify")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "200" ]]; then
        VERIFIED=$(echo "$BODY" | jq -r '.verified // empty')

        if [[ "$VERIFIED" == "true" ]]; then
            print_success "PIN verificado correctamente"
            PIN_VERIFIED=1
            echo "$BODY" | jq '.'
        else
            print_error "PIN inválido"
        fi
    else
        print_error "Verify PIN falló con código $HTTP_CODE"
        echo "$BODY"
    fi
}

# =============================================================================
# Test: Start Trip
# =============================================================================

test_start_trip() {
    if [[ -z "$TRIP_ID" ]] || [[ "$PIN_VERIFIED" -ne 1 ]]; then
        print_warning "Trip ID no disponible, saltando test de start"
        return
    fi

    print_test "Iniciar viaje (PATCH /trips/$TRIP_ID/start)"

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X PATCH \
        -H "Authorization: Bearer $JWT_TOKEN" \
        "${BASE_URL}/${TRIP_ID}/start")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "200" ]]; then
        STATUS=$(echo "$BODY" | jq -r '.status // empty')

        if [[ "$STATUS" == "IN_PROGRESS" ]]; then
            print_success "Trip iniciado exitosamente"
            echo "$BODY" | jq '.'
        else
            print_error "Status inválido: $STATUS"
        fi
    else
        print_error "Start trip falló con código $HTTP_CODE"
        echo "$BODY"
    fi
}

# =============================================================================
# Test: Complete Trip
# =============================================================================

test_complete_trip() {
    if [[ -z "$TRIP_ID" ]] || [[ "$PIN_VERIFIED" -ne 1 ]]; then
        print_warning "Trip ID no disponible, saltando test de complete"
        return
    fi

    print_test "Completar viaje (PATCH /trips/$TRIP_ID/complete)"

    REQUEST_BODY='{
        "distance_m_final": 5800,
        "duration_s_final": 840
    }'

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X PATCH \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d "$REQUEST_BODY" \
        "${BASE_URL}/${TRIP_ID}/complete")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "200" ]]; then
        STATUS=$(echo "$BODY" | jq -r '.status // empty')
        TOTAL_PRICE=$(echo "$BODY" | jq -r '.totalPrice // empty')
        PAYMENT_INTENT=$(echo "$BODY" | jq -r '.paymentIntentId // empty')

        if [[ "$STATUS" == "COMPLETED" ]]; then
            print_success "Trip completado exitosamente"
            print_info "Total Price: \$$TOTAL_PRICE"
            print_info "Payment Intent: $PAYMENT_INTENT"
            echo "$BODY" | jq '.'
        else
            print_error "Status inválido: $STATUS"
        fi
    else
        print_error "Complete trip falló con código $HTTP_CODE"
        echo "$BODY"
    fi
}

# =============================================================================
# Test: Cancel Trip
# =============================================================================

test_cancel_trip() {
    print_test "Crear y cancelar un viaje (para testing de cancel)"

    # Crear nuevo trip para cancelar
    REQUEST_BODY='{
        "riderId": "'"$RIDER_ID"'",
        "vehicleType": "comfort",
        "city": "SCZ",
        "payment_method": "cash",
        "originLat": -17.78345,
        "originLng": -63.18117,
        "originH3Res9": "898b221a42fffff",
        "destLat": -17.79456,
        "destLng": -63.19234,
        "destH3Res9": "898b22c4b63ffff"
    }'

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d "$REQUEST_BODY" \
        "${BASE_URL}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" != "201" ]]; then
        print_error "No se pudo crear trip para cancelar"
        return
    fi

    CANCEL_TRIP_ID=$(echo "$BODY" | jq -r '.id')
    print_info "Trip creado para cancelar: $CANCEL_TRIP_ID"

    # Ahora cancelar
    print_test "Cancelar viaje (PATCH /trips/$CANCEL_TRIP_ID/cancel)"

    CANCEL_BODY='{
        "reason": "RIDER_CANCELLED",
        "side": "rider",
        "notes": "Test de cancelación"
    }'

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X PATCH \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d "$CANCEL_BODY" \
        "${BASE_URL}/${CANCEL_TRIP_ID}/cancel")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" == "200" ]]; then
        STATUS=$(echo "$BODY" | jq -r '.status // empty')
        CANCEL_REASON=$(echo "$BODY" | jq -r '.cancelReason // empty')

        if [[ "$STATUS" == "CANCELED" ]] && [[ "$CANCEL_REASON" == "RIDER_CANCELLED" ]]; then
            print_success "Trip cancelado exitosamente"
            echo "$BODY" | jq '.'
        else
            print_error "Response inválido: $BODY"
        fi
    else
        print_error "Cancel trip falló con código $HTTP_CODE"
        echo "$BODY"
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    print_header "🧪 MS04-TRIPS - Production API Testing"

    # Verificar dependencias
    check_dependencies
    check_jwt
    resolve_driver_id

    print_info "Gateway URL: $GATEWAY_URL"
    print_info "Base URL: $BASE_URL"
    print_info "Rider ID: $RIDER_ID"
    print_info "Driver ID: $DRIVER_ID"

    # Health checks (no requieren autenticación)
    print_header "📊 Health Checks"
    test_health_public
    test_health_database

    # Flujo completo del viaje
    print_header "🚗 Trip Lifecycle - Full Flow"
    test_create_trip

    # Solo continuar si se creó el trip
    if [[ -n "$TRIP_ID" ]]; then
        test_accept_trip
        test_verify_pin
        test_start_trip
        test_complete_trip
    else
        print_error "No se pudo crear el trip inicial, saltando tests restantes"
    fi

    # Test de cancelación (con nuevo trip)
    print_header "❌ Trip Cancellation"
    test_cancel_trip

    # Resumen final
    print_header "📈 Test Summary"
    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
    echo -e "${CYAN}Total Tests:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}Passed:${NC}      $TESTS_PASSED"
    echo -e "${RED}Failed:${NC}      $TESTS_FAILED"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}✅ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        exit 1
    fi
}

# Ejecutar
main

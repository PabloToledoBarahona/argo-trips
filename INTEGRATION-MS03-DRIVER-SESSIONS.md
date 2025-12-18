# MS03 Driver Sessions Integration Guide

**Document Version:** 1.0.0
**Last Updated:** December 18, 2025
**Service:** MS04-TRIPS
**Integration Target:** MS03-DRIVER-SESSIONS v1.0.0

---

## Overview

This document describes the complete integration between MS04-TRIPS and MS03-DRIVER-SESSIONS microservices. The integration enables TRIPS to query real-time driver availability, location, and eligibility status.

## Architecture Decision: HTTP REST vs WebSocket

### Decision: HTTP REST API Only

MS04-TRIPS integrates with MS03-DRIVER-SESSIONS using **HTTP REST API** exclusively. WebSocket connections are **NOT used**.

### Rationale

1. **TRIPS is request-driven**:
   - Driver availability is queried **on-demand** when assigning trips
   - No need for continuous real-time updates
   - Stale data (few seconds old) is acceptable for driver search

2. **WebSocket is designed for different use cases**:
   - Driver mobile apps (send `location.update`, `heartbeat`, `status.update`)
   - Rider mobile apps (receive driver approaching notifications)
   - **NOT** for backend microservice-to-microservice communication

3. **Avoiding unnecessary complexity**:
   - No connection state management required
   - No duplicate data caching
   - Lower resource overhead

### Future Considerations

If real-time events become necessary (e.g., driver goes offline mid-trip), consider:
- Event-driven architecture with message broker (RabbitMQ, Kafka, Redis Pub/Sub)
- Domain events published by Driver Sessions
- Async event consumers in TRIPS

---

## Integration Points

### 1. Get Driver Session Details

**Endpoint:** `GET /driver-sessions/sessions/:driverId`
**Usage:** Verify driver availability and eligibility before accepting trip

```typescript
const session = await driverSessionsClient.getSession('drv_7');

if (!session.online) {
  throw new Error('Driver is not online');
}

if (!session.eligibility.ok) {
  throw new Error('Driver is not eligible');
}

if (!session.last_loc) {
  throw new Error('Driver has no location data');
}

// Use driver location for ETA calculation
const eta = await geoClient.eta({
  origins: [{ lat: session.last_loc.lat, lng: session.last_loc.lng }],
  destinations: [{ lat: tripOriginLat, lng: tripOriginLng }],
  profile: 'car',
  city: 'SCZ'
});
```

**Response Schema:**
```typescript
interface DriverSessionResponse {
  driver_id: string;
  online: boolean;
  last_loc: {
    lat: number;
    lng: number;
    h3_res9: string;
    speed_mps: number;
    heading_deg: number;
    ts: string;
  } | null;
  trip_id: string | null;
  eligibility: {
    ok: boolean;
    status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  };
}
```

### 2. Find Nearby Drivers

**Endpoint:** `GET /driver-sessions/sessions/nearby`
**Usage:** Discover available drivers near trip origin for intelligent assignment

```typescript
// First, get H3 index of trip origin
const h3Index = await geoClient.h3EncodeSingle(tripOriginLat, tripOriginLng, 9);

// Search for nearby drivers
const nearby = await driverSessionsClient.findNearbyDrivers({
  h3: h3Index,
  k: 2,        // Search within 2-ring distance (~1-2 km radius)
  limit: 20    // Return max 20 drivers
});

console.log(`Found ${nearby.drivers.length} drivers in ${nearby.queried_cells.length} H3 cells`);

// Validate each driver and calculate ETAs
for (const driverId of nearby.drivers) {
  const session = await driverSessionsClient.getSession(driverId);

  if (session.online && session.eligibility.ok && session.last_loc) {
    // Calculate ETA and offer trip
  }
}
```

**Query Parameters:**
- `h3` (required): H3 resolution 9 cell (15 characters)
- `k` (optional): k-ring distance (0-5, default: 1)
- `limit` (optional): Max drivers to return (1-100, default: 50)

**Response Schema:**
```typescript
interface NearbyDriversResponse {
  drivers: string[];        // Array of driver IDs
  queried_cells: string[];  // H3 cells that were searched
}
```

---

## Implementation Details

### DriverSessionsClient

**Location:** `src/trips/infrastructure/http-clients/driver-sessions.client.ts`

**Features:**
- JWT authentication via `ServiceTokenService`
- Circuit breaker for fault tolerance
- Rate limiting (100 req/s for session, 50 req/s for nearby)
- Automatic retry with exponential backoff
- Comprehensive request/response validation
- Production-ready error handling

**Configuration:**
```typescript
// Base URL uses API Gateway with /driver-sessions prefix
baseUrl = 'http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/driver-sessions'

// Timeouts
SESSION_TIMEOUT_MS = 3000  // 3 seconds
NEARBY_TIMEOUT_MS = 5000   // 5 seconds

// Circuit breakers
failureThreshold: 5
successThreshold: 2
timeout: 60000  // 1 minute
```

### Environment Variables

**Required:**
```bash
DRIVER_SESSIONS_SERVICE_URL="http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/driver-sessions"
```

**Fallback (development only):**
```bash
# If not set, defaults to:
# http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/driver-sessions
```

---

## Usage in Use Cases

### AcceptTripUseCase

**Location:** `src/trips/application/accept-trip/accept-trip.use-case.ts`

**Validation Flow:**
1. ✅ Verify driver is online (`session.online === true`)
2. ✅ Verify driver is eligible (`session.eligibility.ok === true`)
3. ✅ Verify driver has location data (`session.last_loc !== null`)
4. ✅ Calculate ETA from driver location to pickup
5. ✅ Accept trip and generate PIN

**Error Handling:**
```typescript
// Driver not online
BadRequestException: "Driver drv_7 is not online"

// Driver not eligible
BadRequestException: "Driver drv_7 is not eligible: SUSPENDED"

// Driver has no location
BadRequestException: "Driver drv_7 has no location data available"
```

---

## Production Checklist

- ✅ Gateway URL configured correctly
- ✅ `/driver-sessions` prefix used for all endpoints
- ✅ Response DTOs use snake_case (matching API contract)
- ✅ Circuit breakers configured per endpoint
- ✅ Rate limiting implemented
- ✅ JWT authentication via ServiceTokenService
- ✅ Comprehensive validation of requests and responses
- ✅ Error handling with descriptive messages
- ✅ Logging at appropriate levels (debug, error)
- ✅ OnModuleInit lifecycle for rate limiter setup
- ✅ TypeScript strict mode compliance
- ✅ No WebSocket dependencies (by design)

---

## Testing Recommendations

### Unit Tests

```typescript
describe('DriverSessionsClient', () => {
  it('should get driver session with correct URL and headers', async () => {
    // Verify URL: baseUrl/sessions/:driverId
    // Verify headers include JWT token
    // Verify timeout is 3000ms
  });

  it('should find nearby drivers with correct query params', async () => {
    // Verify URL: baseUrl/sessions/nearby?h3=xxx&k=2&limit=20
    // Verify H3 validation (15 characters, resolution 9)
    // Verify k range (0-5)
  });

  it('should validate response schema', async () => {
    // Verify driver_id, online, eligibility are present
    // Verify last_loc can be null
  });
});
```

### Integration Tests

```typescript
describe('AcceptTripUseCase with Driver Sessions', () => {
  it('should reject trip if driver is offline', async () => {
    // Mock driver session with online: false
    // Expect BadRequestException
  });

  it('should reject trip if driver is not eligible', async () => {
    // Mock driver session with eligibility.ok: false
    // Expect BadRequestException with status message
  });

  it('should calculate ETA using driver location', async () => {
    // Mock driver session with valid last_loc
    // Verify ETA request uses driver coordinates as origin
  });
});
```

---

## Monitoring and Observability

### Key Metrics to Track

1. **Driver Session Query Rate**
   - Requests per second to `/sessions/:driverId`
   - Expected: Spikes during peak hours

2. **Nearby Search Performance**
   - Response time for `/sessions/nearby`
   - Expected: < 500ms at p95

3. **Circuit Breaker State**
   - Monitor open/closed state
   - Alert on persistent failures (> 5 consecutive)

4. **Validation Failures**
   - Track rejections due to driver offline/ineligible
   - Helps identify driver retention issues

### Log Examples

```
[DriverSessionsClient] Driver Sessions Client initialized with base URL: http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/driver-sessions

[DriverSessionsClient] Getting session for driver: drv_7
[DriverSessionsClient] Driver session: drv_7, online=true, eligible=true, trip=none

[DriverSessionsClient] Finding nearby drivers: h3=8928308280fffff, k=2, limit=20
[DriverSessionsClient] Found 15 nearby drivers in 19 cells

[AcceptTripUseCase] Driver drv_7 accepting trip trip-123
[AcceptTripUseCase] Trip trip-123 accepted by driver drv_7, ETA: 180s (850m)
```

---

## Troubleshooting

### Issue: "Driver Sessions service failed: timeout of 3000ms exceeded"

**Cause:** Network latency or Driver Sessions service overload
**Solution:**
- Check Gateway health
- Verify Driver Sessions service is running
- Review circuit breaker state

### Issue: "Invalid session response: missing driver_id"

**Cause:** API contract mismatch or malformed response
**Solution:**
- Verify MS03-DRIVER-SESSIONS is up to date (v1.0.0)
- Check Gateway routing configuration
- Review response schema in this document

### Issue: "Driver drv_7 is not eligible: SUSPENDED"

**Cause:** Driver failed eligibility check in MS02-PROFILES
**Solution:**
- This is expected behavior, not a bug
- Driver needs to update documentation or resolve suspension
- TRIPS correctly rejects the trip assignment

---

## References

- **MS03-DRIVER-SESSIONS Documentation:** v1.0.0 (December 17, 2025)
- **API Gateway URL:** `http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com`
- **Driver Sessions Namespace (WebSocket):** `/rt/driver` (NOT used by TRIPS)
- **Driver Sessions Path (WebSocket):** `/driver-sessions/socket.io` (NOT used by TRIPS)

---

## Changelog

### v1.0.0 - December 18, 2025
- ✅ Initial integration with MS03-DRIVER-SESSIONS
- ✅ Implemented GET /sessions/:driverId endpoint
- ✅ Implemented GET /sessions/nearby endpoint
- ✅ Added circuit breakers and rate limiting
- ✅ Integrated with AcceptTripUseCase
- ✅ Documented architecture decision (HTTP-only, no WebSocket)
- ✅ Production-ready validation and error handling

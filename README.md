# MS04 - Trips Microservice

**MS04-TRIPS** is a production-ready NestJS microservice responsible for managing the complete lifecycle of ride-sharing trips in the Argo platform. Built with TypeScript and following clean architecture principles, it orchestrates trip creation, driver assignment, trip execution, and payment processing through seamless integration with multiple microservices.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Event Bus](#event-bus)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Service Integrations](#service-integrations)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Overview

MS04-TRIPS serves as the core orchestrator for trip management in the Argo ride-sharing platform. It handles:

- Trip creation and lifecycle management (REQUESTED → ACCEPTED → PIN_VERIFIED → IN_PROGRESS → COMPLETED)
- Integration with pricing service for dynamic fare calculation
- Geospatial operations via H3 indexing and geocoding
- Driver session validation and assignment
- Payment intent creation upon trip completion
- Real-time trip state transitions with validation

## Architecture

The service follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── trips/
│   ├── application/          # Use cases (business logic)
│   ├── domain/               # Domain entities and value objects
│   ├── infrastructure/       # External integrations (HTTP clients, DB)
│   └── interfaces/           # HTTP controllers and DTOs
├── shared/
│   ├── auth/                 # JWT authentication & service tokens
│   ├── circuit-breaker/      # Circuit breaker pattern implementation
│   ├── rate-limiter/         # Token bucket rate limiting
│   └── http/                 # Custom HTTP service with retry logic
└── prisma/                   # Database schema and migrations
```

### Key Architectural Patterns

- **Clean Architecture**: Business logic isolated from infrastructure
- **Domain-Driven Design**: Rich domain models with encapsulated business rules
- **CQRS**: Separation of command and query responsibilities
- **Circuit Breaker**: Fault tolerance for external service calls
- **Rate Limiting**: Token bucket algorithm for API protection
- **Repository Pattern**: Abstract data access layer

## Features

### Core Functionality

- **Trip Lifecycle Management**: Complete state machine for trip progression
- **Dynamic Pricing Integration**: Real-time fare calculation with surge pricing
- **Geospatial Processing**: H3 indexing for location-based operations
- **Driver Assignment**: Integration with driver session management
- **Payment Processing**: Automated payment intent creation
- **PIN Verification**: Secure rider verification before trip start

### Production-Ready Features

- **Service-to-Service Authentication**: JWT-based authentication with automatic token renewal
- **Health Checks**: Comprehensive health endpoints with database connectivity checks
- **Circuit Breaker Protection**: Automatic failover for external service calls
- **Rate Limiting**: Request throttling per endpoint
- **Structured Logging**: JSON-formatted logs with request correlation
- **Graceful Degradation**: Fallback mechanisms for partial service availability
- **Idempotency**: Safe retry mechanisms for critical operations
- **Event-Driven Communication**: Redis Streams for inter-service messaging

## Event Bus

The service implements an Event Bus architecture using **Redis Streams** for asynchronous inter-microservice communication. This enables loose coupling between services and reliable event delivery.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Redis Event Bus                        │
│                 (Redis Streams - Upstash)                        │
├─────────────────────────────────────────────────────────────────┤
│  stream:trips    │  stream:payments  │  stream:drivers          │
└────────┬─────────┴────────┬──────────┴────────┬─────────────────┘
         │                  │                   │
    ┌────▼────┐        ┌────▼────┐         ┌────▼────┐
    │ MS04    │        │ MS07    │         │ MS03    │
    │ Trips   │        │Payments │         │ Driver  │
    │         │        │         │         │Sessions │
    └─────────┘        └─────────┘         └─────────┘
```

Each microservice has:
- **Internal Redis**: For cache, sessions, and state management
- **Shared Event Bus**: For publishing and consuming events across services

### Events Published (by MS04-Trips)

| Event Type | Stream | Payload | Trigger |
|------------|--------|---------|---------|
| `trip.created` | `stream:trips` | tripId, riderId, vehicleType, paymentMethod, origin, destination, pricing | Trip creation |
| `trip.assigned` | `stream:trips` | tripId, riderId, driverId, estimatedArrival | Driver accepts trip |
| `trip.completed` | `stream:trips` | tripId, riderId, driverId, totalPrice, currency, paymentIntentId | Trip completion |
| `trip.cancelled` | `stream:trips` | tripId, riderId, driverId, cancelledBy, reason, cancellationFee | Trip cancellation |

### Events Consumed (by MS04-Trips)

| Event Type | Stream | Action |
|------------|--------|--------|
| `payment.captured` | `stream:payments` | Updates trip status to PAID |
| `payment.failed` | `stream:payments` | Logs payment failure for trip |
| `driver.offline` | `stream:drivers` | Cancels trip if driver goes offline |

### Consumer Groups

Events are consumed using Redis Streams consumer groups, ensuring:
- **Reliable delivery**: Messages are acknowledged after processing
- **Fault tolerance**: Unacknowledged messages are re-delivered
- **Scalability**: Multiple instances can share the workload

## Technology Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (Neon serverless)
- **Cache**: Redis (Upstash)
- **ORM**: Prisma 6.x
- **HTTP Client**: Axios with custom retry logic
- **Geospatial**: H3 hexagonal hierarchical geospatial indexing
- **Deployment**: AWS ECS Fargate
- **Container**: Docker (multi-stage build)

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker (for containerized deployment)
- PostgreSQL 14+ (or Neon serverless)
- Redis 6+ (or Upstash)

## Installation

```bash
# Clone the repository
git clone https://github.com/PabloToledoBarahona/argo-trips.git
cd argo-trips

# Install dependencies
pnpm install

# Generate Prisma client
pnpm exec prisma generate

# Run database migrations
pnpm exec prisma migrate deploy
```

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following configuration:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/argo-trips?sslmode=require"

# Redis Internal (cache, sessions, state)
REDIS_URL="rediss://default:password@internal-redis-host:6379"

# Redis Event Bus (shared across microservices)
REDIS_EVENT_BUS_URL="rediss://default:password@shared-eventbus-host:6379"

# Service URLs
PRICING_SERVICE_URL="http://gateway-url/pricing"
GEO_SERVICE_URL="http://gateway-url/geo"
DRIVER_SESSIONS_SERVICE_URL="http://gateway-url/driver-sessions"
AUTH_SERVICE_URL="http://gateway-url/auth"
PAYMENTS_URL="http://gateway-url/payments"

# Service Authentication
SERVICE_ID="argo-trips"
SERVICE_EMAIL="service-trips@argo.internal"
SERVICE_PASSWORD="your-service-password"

# Application
PORT=3000
NODE_ENV=production
```

### Required Secrets

For production deployment, the following secrets should be stored in AWS Secrets Manager:

- `/argo/trips/database-url`: PostgreSQL connection string
- `/argo/trips/redis-url`: Redis internal cache connection string
- `/argo/trips/redis-event-bus-url`: Redis Event Bus connection string (shared)

## Running the Application

### Development Mode

```bash
# Start with hot reload
pnpm run start:dev

# The service will be available at http://localhost:3000
```

### Production Mode

```bash
# Build the application
pnpm run build

# Start production server
pnpm run start:prod
```

### Docker

```bash
# Build Docker image
docker build -t argo-trips:latest .

# Run container
docker run -p 3000:3000 --env-file .env argo-trips:latest
```

## Testing

### Available Testing Tools

The repository includes comprehensive testing tools:

1. **Postman Collection** (`postman-collection.json`)
   - Pre-configured requests for all endpoints
   - Automated assertions
   - Environment variables management

2. **Automated Test Script** (`test-endpoints.sh`)
   - Bash script for automated testing
   - Tests complete trip lifecycle
   - Colored output with detailed results

### Running Tests

```bash
# Unit tests
pnpm run test

# End-to-end tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov

# Run automated endpoint tests
./test-endpoints.sh <JWT_TOKEN>
```

For detailed testing instructions, see [TESTING.md](./TESTING.md).

## API Documentation

### Endpoints

#### Health Checks

- `GET /health` - Comprehensive health check with database status
- `GET /healthz` - Simple health check for load balancers

#### Trip Management

- `POST /trips` - Create a new trip
  - **Request**: `{ riderId, vehicleType, city, paymentMethod, originLat, originLng, originH3Res9, destLat, destLng, destH3Res9 }`
  - **Required Fields**: All fields are required. `paymentMethod` must be `"cash"` or `"qr"`
  - **Response**: Trip details with pricing quote and payment method

- `PATCH /trips/:id/accept` - Driver accepts trip
  - **Request**: `{ driverId, estimatedArrivalMin }`
  - **Response**: Updated trip with driver assignment

- `POST /trips/:id/pin/verify` - Verify rider PIN
  - **Request**: `{ pin }`
  - **Response**: Verification status

- `PATCH /trips/:id/start` - Start trip
  - **Response**: Trip status updated to IN_PROGRESS

- `PATCH /trips/:id/complete` - Complete trip
  - **Request**: `{ finalLat, finalLng, distanceMeters, durationSeconds }`
  - **Response**: Final pricing and payment intent

- `PATCH /trips/:id/cancel` - Cancel trip
  - **Request**: `{ reason, cancelledBy }`
  - **Response**: Cancelled trip with cancellation details

### Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

Service-to-service calls use automatically managed service tokens obtained from MS02-AUTH.

## Service Integrations

### MS02-AUTH - Authentication Service
- **Purpose**: Service-to-service authentication
- **Integration**: Automatic JWT token management with renewal
- **Endpoint**: `POST /admin/login`

### MS06-PRICING - Pricing Service
- **Purpose**: Dynamic fare calculation
- **Integration**: Quote generation and price finalization
- **Endpoints**:
  - `POST /quote` - Initial price estimate
  - `POST /finalize` - Final price calculation

### MS10-GEO - Geospatial Service
- **Purpose**: Location processing and routing
- **Integration**: H3 encoding, geocoding, route calculation
- **Endpoints**:
  - `POST /h3/encode` - Convert coordinates to H3 index
  - `POST /geocode/forward` - Address to coordinates
  - `POST /route` - Calculate route between points

### MS03-DRIVER-SESSIONS - Driver Management
- **Purpose**: Driver availability and location
- **Integration**: Driver session validation and nearby driver search
- **Endpoints**:
  - `GET /sessions/:driverId` - Get driver session details
  - `GET /sessions/nearby` - Find nearby available drivers

### MS07-PAYMENTS - Payment Processing
- **Purpose**: Payment intent creation
- **Integration**: Automated payment processing on trip completion
- **Endpoint**: `POST /payment-intents` - Create payment intent

## Deployment

### AWS ECS Fargate - Optimized Architecture

The service is deployed to AWS ECS Fargate following the cost-optimized architecture guidelines (January 2026):

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Account: 522195962216                     │
│                       Region: us-east-2                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Internet ──► ALB (Shared) ──► /trips/* ──► Target Group       │
│                    │                              │              │
│                    └── Path-based routing         ▼              │
│                                           ┌─────────────┐        │
│   Cloud Map (argo.local)                  │ ECS Fargate │        │
│        │                                  │ argo-trips  │        │
│        └── argo-trips.argo.local ────────►│   :3000     │        │
│                                           └─────────────┘        │
│                                                  │               │
│                                    Single-AZ: us-east-2a         │
│                                    Subnet: subnet-09d829aab...   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **1 ALB Shared** | Cost reduction: $129/mo → $21/mo (saves $108/mo) |
| **Single-AZ (dev)** | Cost reduction: $64/mo → $7/mo (saves $57/mo) |
| **Cloud Map** | Service discovery for internal communication |
| **desiredCount=0** | Cost control: only run when actively developing |
| **7-day log retention** | Prevent unbounded CloudWatch costs |

### Deployment Script

```bash
# Deploy to AWS ECS Fargate
./deploy-trips.sh
```

The deployment script handles:
- Docker image building for linux/amd64 (buildx)
- ECR repository creation with security scanning
- CloudWatch log group with 7-day retention (mandatory)
- Cloud Map service registration (`argo-trips.argo.local`)
- ECS task definition with secrets injection
- Service creation with desiredCount=0 (cost control)
- Automatic deployment updates for existing services

### Service Lifecycle Commands

```bash
# Start service (when actively developing)
aws ecs update-service \
  --cluster argo-cluster \
  --service argo-trips-service \
  --desired-count 1 \
  --region us-east-2

# Stop service (when done - IMPORTANT for cost control)
aws ecs update-service \
  --cluster argo-cluster \
  --service argo-trips-service \
  --desired-count 0 \
  --region us-east-2

# Check service status
aws ecs describe-services \
  --cluster argo-cluster \
  --services argo-trips-service \
  --region us-east-2 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

### Infrastructure Requirements

| Resource | Value | Notes |
|----------|-------|-------|
| **AWS Account** | `522195962216` | New optimized account |
| **Region** | `us-east-2` | Ohio |
| **ECS Cluster** | `argo-cluster` | Shared cluster |
| **Subnet (dev)** | `subnet-09d829aab7d6307a6` | Single-AZ: us-east-2a |
| **Security Group** | `sg-0be38c7c217448d01` | ECS tasks SG |
| **Cloud Map** | `argo.local` | Service discovery namespace |
| **ALB** | `argo-shared-alb-828452645...` | Shared ALB with path routing |

### Required Secrets (AWS Secrets Manager)

Before first deployment, create these secrets:

```bash
# Database connection
aws secretsmanager create-secret \
  --name /argo/trips/database-url \
  --secret-string "postgresql://user:pass@host:5432/db" \
  --region us-east-2

# Redis internal cache
aws secretsmanager create-secret \
  --name /argo/trips/redis-url \
  --secret-string "rediss://default:token@host:6379" \
  --region us-east-2

# Redis Event Bus (shared)
aws secretsmanager create-secret \
  --name /argo/trips/redis-event-bus-url \
  --secret-string "rediss://default:token@eventbus-host:6379" \
  --region us-east-2
```

### Gateway Configuration

Request the DevOps team to configure the shared ALB:

- **Path Pattern**: `/trips/*`
- **Target Group**: `argo-trips-tg`
- **Health Check Path**: `/health`
- **Port**: 3000
- **Priority**: 60 (after other services)

### Cost Estimation (Development)

| Component | Always-On | With Scheduler |
|-----------|-----------|----------------|
| ECS Fargate (512 CPU, 1GB) | $18/mo | $7/mo (40% uptime) |
| ALB (shared, 1/7 cost) | $3/mo | $3/mo |
| CloudWatch Logs | $1/mo | $1/mo |
| Secrets Manager (3 secrets) | $1.20/mo | $1.20/mo |
| **Total** | **$23/mo** | **$12/mo** |

## Project Structure

```
argo-trips/
├── src/
│   ├── trips/                      # Trips domain module
│   │   ├── application/            # Use cases
│   │   │   ├── create-trip/
│   │   │   ├── accept-trip/
│   │   │   ├── verify-pin/
│   │   │   ├── start-trip/
│   │   │   ├── complete-trip/
│   │   │   └── cancel-trip/
│   │   ├── domain/                 # Domain entities
│   │   │   ├── trip.entity.ts
│   │   │   └── value-objects/
│   │   ├── infrastructure/         # External integrations
│   │   │   ├── http-clients/
│   │   │   │   ├── pricing.client.ts
│   │   │   │   ├── geo.client.ts
│   │   │   │   └── driver-sessions.client.ts
│   │   │   └── persistence/
│   │   │       └── trip.repository.ts
│   │   └── interfaces/             # HTTP layer
│   │       └── http/
│   │           └── trips.controller.ts
│   ├── shared/                     # Shared modules
│   │   ├── auth/                   # Authentication
│   │   ├── circuit-breaker/        # Resilience patterns
│   │   ├── event-bus/              # Redis Streams Event Bus
│   │   │   ├── event-bus.service.ts
│   │   │   ├── events.interface.ts
│   │   │   └── trip-events.handler.ts
│   │   ├── rate-limiter/           # Rate limiting
│   │   └── http/                   # HTTP utilities
│   └── main.ts                     # Application entry point
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Database migrations
├── test/                           # E2E tests
├── deploy-trips.sh                 # AWS deployment script
├── test-endpoints.sh               # Automated testing script
├── postman-collection.json         # Postman collection
├── Dockerfile                      # Multi-stage Docker build
├── TESTING.md                      # Testing documentation
├── GATEWAY-FIX.md                  # Gateway configuration notes
└── README.md                       # This file
```

## Contributing

### Development Workflow

1. Create a feature branch from `main`
2. Implement changes following the existing architecture
3. Write tests for new functionality
4. Ensure all tests pass: `pnpm run test`
5. Build the project: `pnpm run build`
6. Commit with conventional commits format
7. Push and create a pull request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Maintain clean architecture boundaries
- Document complex business logic
- Write meaningful commit messages

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## License

This project is proprietary software developed for the Argo ride-sharing platform.

---

**Version**: 1.3.0
**Last Updated**: January 2026
**Maintained By**: Argo Platform Team

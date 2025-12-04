<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

**MS04 - TRIPS** is a NestJS microservice for managing ride-sharing trips in the Argo platform. It handles the complete trip lifecycle from request to payment, integrating with multiple services including Pricing (MS06), Payments (MS07), Geo (MS10), Profiles (MS02), and Driver Sessions (MS03).

## Architecture Overview

### Integration with MS06 - PRICING

TRIPS consumes the Pricing microservice (MS06) for dynamic pricing calculations:

#### During Trip Creation
- **Endpoint**: `POST /pricing/quote`
- **Purpose**: Get initial price estimate for trip request
- **Request includes**:
  - City, vehicle type, rider ID
  - Origin/destination coordinates with H3 indices (res7/res9)
  - Estimated distance and duration (when available)
- **Response includes**:
  - `quoteId`: Unique identifier for the quote
  - `estimateTotal`: Total estimated price
  - `basePrice`: Base fare
  - `surgeMultiplier`: Dynamic pricing multiplier
  - `currency`: Price currency (e.g., USD, EUR)
  - `breakdown`: Price breakdown (distancePrice, timePrice, serviceFee, specialCharges)
  - `distanceMeters`, `durationSeconds`: Route metrics
- **Storage**: TRIPS persists a `pricingSnapshot` with all quote details for audit and consistency

#### During Trip Completion
- **Endpoint**: `POST /pricing/finalize`
- **Purpose**: Calculate final price with actual trip metrics
- **Request includes**:
  - `quoteId`: Original quote identifier
  - `tripId`: Trip identifier (for idempotency)
  - Actual distance and duration traveled
- **Response includes**:
  - `totalPrice`: Final price after applying actual metrics
  - `basePrice`, `surgeMultiplier`, `currency`: Final pricing components
  - `breakdown`: Final price breakdown with specialCharges
  - `taxes`: Optional tax amount
- **Storage**: TRIPS updates `pricingSnapshot` with final pricing details
- **Next step**: TRIPS creates a payment intent with MS07-PAYMENTS using `totalPrice` and `currency`

### Key Features

- **Pricing Contract Alignment**: All pricing fields match MS06 specifications:
  - Use `estimateTotal` (not `estimatedTotal`) for quotes
  - Use `totalPrice` (not `finalPrice`) for completed trips
  - Use `surgeMultiplier` (not `dynamicMultiplier`) for dynamic pricing
  - Support for `taxes` and `specialCharges` in final pricing

- **Graceful Degradation**:
  - Falls back to client-provided H3 indices if GeoClient unavailable
  - Uses estimated metrics when actual metrics not available
  - Continues operation with partial data when possible

- **Idempotency**: Pricing finalization is idempotent via `tripId` parameter

### Exposed API Endpoints

TRIPS exposes the following endpoints with full pricing details:

- `POST /api/trips/trips` - Create trip
  - Returns: `quoteId`, `estimateTotal`, `basePrice`, `surgeMultiplier`, `currency`, `breakdown`, `distanceMeters`, `durationSeconds`

- `PATCH /api/trips/trips/:id/complete` - Complete trip
  - Returns: `totalPrice`, `basePrice`, `surgeMultiplier`, `currency`, `breakdown`, `taxes`, `paymentIntentId`

All pricing fields are exposed to clients through the Gateway for transparency and consistency.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

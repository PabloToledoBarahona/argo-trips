import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateTripDto, CreateTripResponseDto } from '../../application/create-trip/create-trip.dto.js';
import { AcceptTripDto, AcceptTripResponseDto } from '../../application/accept-trip/accept-trip.dto.js';
import { VerifyPinDto, VerifyPinResponseDto } from '../../application/verify-pin/verify-pin.dto.js';
import { StartTripDto, StartTripResponseDto } from '../../application/start-trip/start-trip.dto.js';
import { CompleteTripDto, CompleteTripResponseDto } from '../../application/complete-trip/complete-trip.dto.js';
import { CancelTripDto, CancelTripResponseDto } from '../../application/cancel-trip/cancel-trip.dto.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { ArgoUser } from '../../../shared/auth/types/argo-user.type.js';
import { TripsHttpHandler } from './trips.handler.js';

@Controller('trips')
export class TripsController {
  constructor(private readonly handler: TripsHttpHandler) {}

  @Get()
  async listTrips(@Query() query: Record<string, string | undefined>, @CurrentUser() user: ArgoUser) {
    return this.handler.listTrips(query, user);
  }

  @Get(':id')
  async getTrip(@Param('id') id: string, @CurrentUser() user: ArgoUser) {
    return this.handler.getTrip(id, user);
  }

  @Post()
  async createTrip(
    @Body() dto: CreateTripDto,
    @CurrentUser() user: ArgoUser,
  ): Promise<CreateTripResponseDto> {
    return await this.handler.createTrip(dto, user);
  }

  @Patch(':id/accept')
  async acceptTrip(
    @Param('id') id: string,
    @Body() dto: Omit<AcceptTripDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<AcceptTripResponseDto> {
    return await this.handler.acceptTrip(id, dto, user);
  }

  @Post(':id/pin/verify')
  async verifyPin(
    @Param('id') id: string,
    @Body() dto: Omit<VerifyPinDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<VerifyPinResponseDto> {
    return await this.handler.verifyPin(id, dto, user);
  }

  @Patch(':id/start')
  async startTrip(
    @Param('id') id: string,
    @CurrentUser() user: ArgoUser,
  ): Promise<StartTripResponseDto> {
    return await this.handler.startTrip(id, user);
  }

  @Patch(':id/complete')
  async completeTrip(
    @Param('id') id: string,
    @Body() dto: Omit<CompleteTripDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<CompleteTripResponseDto> {
    return await this.handler.completeTrip(id, dto, user);
  }

  @Patch(':id/cancel')
  async cancelTrip(
    @Param('id') id: string,
    @Body() dto: Omit<CancelTripDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<CancelTripResponseDto> {
    return await this.handler.cancelTrip(id, dto, user);
  }
}

import { Controller, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CreateTripUseCase } from '../../application/create-trip/create-trip.use-case.js';
import { AcceptTripUseCase } from '../../application/accept-trip/accept-trip.use-case.js';
import { VerifyPinUseCase } from '../../application/verify-pin/verify-pin.use-case.js';
import { StartTripUseCase } from '../../application/start-trip/start-trip.use-case.js';
import { CompleteTripUseCase } from '../../application/complete-trip/complete-trip.use-case.js';
import { CancelTripUseCase } from '../../application/cancel-trip/cancel-trip.use-case.js';
import { CreateTripDto, CreateTripResponseDto } from '../../application/create-trip/create-trip.dto.js';
import { AcceptTripDto, AcceptTripResponseDto } from '../../application/accept-trip/accept-trip.dto.js';
import { VerifyPinDto, VerifyPinResponseDto } from '../../application/verify-pin/verify-pin.dto.js';
import { StartTripDto, StartTripResponseDto } from '../../application/start-trip/start-trip.dto.js';
import { CompleteTripDto, CompleteTripResponseDto } from '../../application/complete-trip/complete-trip.dto.js';
import { CancelTripDto, CancelTripResponseDto } from '../../application/cancel-trip/cancel-trip.dto.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { ArgoUser } from '../../../shared/auth/types/argo-user.type.js';

@Controller('trips')
export class TripsController {
  constructor(
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly acceptTripUseCase: AcceptTripUseCase,
    private readonly verifyPinUseCase: VerifyPinUseCase,
    private readonly startTripUseCase: StartTripUseCase,
    private readonly completeTripUseCase: CompleteTripUseCase,
    private readonly cancelTripUseCase: CancelTripUseCase,
  ) {}

  @Post()
  async createTrip(
    @Body() dto: CreateTripDto,
    @CurrentUser() user: ArgoUser,
  ): Promise<CreateTripResponseDto> {
    return await this.createTripUseCase.execute(dto);
  }

  @Patch(':id/accept')
  async acceptTrip(
    @Param('id') id: string,
    @Body() dto: Omit<AcceptTripDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<AcceptTripResponseDto> {
    return await this.acceptTripUseCase.execute({ ...dto, tripId: id });
  }

  @Post(':id/pin/verify')
  async verifyPin(
    @Param('id') id: string,
    @Body() dto: Omit<VerifyPinDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<VerifyPinResponseDto> {
    return await this.verifyPinUseCase.execute({ ...dto, tripId: id });
  }

  @Patch(':id/start')
  async startTrip(
    @Param('id') id: string,
    @CurrentUser() user: ArgoUser,
  ): Promise<StartTripResponseDto> {
    return await this.startTripUseCase.execute({ tripId: id });
  }

  @Patch(':id/complete')
  async completeTrip(
    @Param('id') id: string,
    @Body() dto: Omit<CompleteTripDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<CompleteTripResponseDto> {
    return await this.completeTripUseCase.execute({ ...dto, tripId: id });
  }

  @Patch(':id/cancel')
  async cancelTrip(
    @Param('id') id: string,
    @Body() dto: Omit<CancelTripDto, 'tripId'>,
    @CurrentUser() user: ArgoUser,
  ): Promise<CancelTripResponseDto> {
    return await this.cancelTripUseCase.execute({ ...dto, tripId: id });
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
import type { ArgoUser } from '../../../shared/auth/types/argo-user.type.js';
import { CancelSide } from '../../domain/enums/cancel-side.enum.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import {
  TripListFilters,
  TripPrismaRepository,
} from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import type { ActorContext } from '../../application/shared/actor-context.js';

@Injectable()
export class TripsHttpHandler {
  constructor(
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly acceptTripUseCase: AcceptTripUseCase,
    private readonly verifyPinUseCase: VerifyPinUseCase,
    private readonly startTripUseCase: StartTripUseCase,
    private readonly completeTripUseCase: CompleteTripUseCase,
    private readonly cancelTripUseCase: CancelTripUseCase,
    private readonly tripRepository: TripPrismaRepository,
  ) {}

  async createTrip(
    dto: CreateTripDto,
    user: ArgoUser,
  ): Promise<CreateTripResponseDto> {
    this.assertRole(user, ['rider', 'admin']);
    this.assertRiderMatches(user, dto.riderId);
    return await this.createTripUseCase.execute(dto, this.resolveActor(user));
  }

  async acceptTrip(
    id: string,
    dto: Omit<AcceptTripDto, 'tripId'>,
    user: ArgoUser,
  ): Promise<AcceptTripResponseDto> {
    this.assertRole(user, ['driver', 'admin']);
    return await this.acceptTripUseCase.execute(
      { ...dto, tripId: id },
      this.resolveActor(user),
    );
  }

  async verifyPin(
    id: string,
    dto: Omit<VerifyPinDto, 'tripId'>,
    user: ArgoUser,
  ): Promise<VerifyPinResponseDto> {
    this.assertRole(user, ['rider', 'admin']);
    return await this.verifyPinUseCase.execute(
      { ...dto, tripId: id },
      this.resolveActor(user),
    );
  }

  async startTrip(
    id: string,
    user: ArgoUser,
  ): Promise<StartTripResponseDto> {
    this.assertRole(user, ['driver', 'admin']);
    return await this.startTripUseCase.execute(
      { tripId: id },
      this.resolveActor(user),
    );
  }

  async completeTrip(
    id: string,
    dto: Omit<CompleteTripDto, 'tripId'>,
    user: ArgoUser,
  ): Promise<CompleteTripResponseDto> {
    this.assertRole(user, ['driver', 'admin']);
    return await this.completeTripUseCase.execute(
      { ...dto, tripId: id },
      this.resolveActor(user),
    );
  }

  async cancelTrip(
    id: string,
    dto: Omit<CancelTripDto, 'tripId'>,
    user: ArgoUser,
  ): Promise<CancelTripResponseDto> {
    if (dto.side === CancelSide.RIDER) {
      this.assertRole(user, ['rider', 'admin']);
    } else if (dto.side === CancelSide.DRIVER) {
      this.assertRole(user, ['driver', 'admin']);
    } else {
      this.assertRole(user, ['admin']);
    }

    return await this.cancelTripUseCase.execute(
      { ...dto, tripId: id },
      this.resolveActor(user),
    );
  }

  async getTrip(id: string, user: ArgoUser) {
    this.assertRole(user, ['admin']);
    const trip = await this.tripRepository.findById(id);
    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }
    return trip;
  }

  async listTrips(query: Record<string, string | undefined>, user: ArgoUser) {
    this.assertRole(user, ['admin']);

    const status = query.status && query.status in TripStatus ? (query.status as TripStatus) : undefined;

    const filters: TripListFilters = {
      status,
      city: query.city,
      driverId: query.driver_id,
      riderId: query.rider_id,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page ? Number.parseInt(query.page, 10) : undefined,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
    };

    return this.tripRepository.findMany(filters);
  }

  private assertRole(user: ArgoUser, allowed: Array<'rider' | 'driver' | 'admin'>): void {
    const hasRole = allowed.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('User is not authorized for this action');
    }
  }

  private assertRiderMatches(user: ArgoUser, riderId: string): void {
    if (user.roles.includes('rider') && user.sub !== riderId) {
      throw new ForbiddenException('riderId does not match authenticated user');
    }
  }

  private resolveActor(user: ArgoUser): ActorContext {
    if (user.roles.includes('admin')) {
      return { id: user.sub, role: 'admin' };
    }
    if (user.roles.includes('driver')) {
      return { id: user.sub, role: 'driver' };
    }
    return { id: user.sub, role: 'rider' };
  }
}

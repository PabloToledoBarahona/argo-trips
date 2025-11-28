import { Trip } from '../entities/trip.entity.js';
import { TripCommand } from '../types/trip-command.type.js';
import { TransitionContext } from '../types/transition-context.type.js';
export declare class TripStateMachine {
    private static readonly MAX_PICKUP_DISTANCE_METERS;
    transition(trip: Trip, command: TripCommand, context: TransitionContext): Trip;
    private handleRequest;
    private handleOffer;
    private handleAssign;
    private handleStartPickup;
    private handleStart;
    private handleComplete;
    private handleCancel;
    private handleMarkPaid;
    private validateTransition;
    private validatePIN;
    private validateDistanceToOrigin;
    private validateActorAuthorization;
    private validateCancelAuthorization;
}

import { Trip } from '../entities/trip.entity.js';
import { TripCommand } from '../types/trip-command.type.js';
import { TransitionContext } from '../types/transition-context.type.js';
export declare class TripStateMachine {
    transition(trip: Trip, command: TripCommand, context: TransitionContext): Trip;
    private validateTransition;
}

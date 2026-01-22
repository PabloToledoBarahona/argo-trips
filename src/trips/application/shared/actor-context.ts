export type ActorRole = 'rider' | 'driver' | 'admin';

export interface ActorContext {
  id: string;
  role: ActorRole;
}

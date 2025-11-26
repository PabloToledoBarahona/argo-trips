export interface ArgoUser {
  sub: string;
  roles: string[];
  identityType: 'rider' | 'driver' | 'admin';
  deviceId?: string;
}

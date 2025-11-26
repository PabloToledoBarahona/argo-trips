export class Location {
  constructor(
    public readonly lat: number,
    public readonly lng: number,
    public readonly h3_res9: string,
  ) {
    if (lat < -90 || lat > 90) {
      throw new Error('Invalid latitude');
    }
    if (lng < -180 || lng > 180) {
      throw new Error('Invalid longitude');
    }
  }

  toString(): string {
    return `${this.lat},${this.lng}`;
  }
}

export class Metrics {
  constructor(
    public readonly distance_m: number,
    public readonly duration_s: number,
    public readonly phase: string,
  ) {
    if (distance_m < 0) {
      throw new Error('Distance cannot be negative');
    }
    if (duration_s < 0) {
      throw new Error('Duration cannot be negative');
    }
  }
}

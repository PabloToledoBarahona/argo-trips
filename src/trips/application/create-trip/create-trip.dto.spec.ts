import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTripDto } from './create-trip.dto.js';
import { PaymentMethod } from '../../domain/enums/payment-method.enum.js';

describe('CreateTripDto', () => {
  const basePayload = {
    riderId: 'rider-123',
    vehicleType: 'economy',
    city: 'New York',
    originLat: 40.7128,
    originLng: -74.006,
    originH3Res9: 'h3-origin-res9',
    destLat: 40.7589,
    destLng: -73.9851,
    destH3Res9: 'h3-dest-res9',
  };

  it('accepts payment_method alias', async () => {
    const dto = plainToInstance(CreateTripDto, {
      ...basePayload,
      payment_method: PaymentMethod.CASH,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.payment_method).toBe(PaymentMethod.CASH);
  });

  it('accepts payment_channel alias', async () => {
    const dto = plainToInstance(CreateTripDto, {
      ...basePayload,
      payment_channel: PaymentMethod.QR,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.payment_channel).toBe(PaymentMethod.QR);
  });

  it('rejects missing payment method', async () => {
    const dto = plainToInstance(CreateTripDto, basePayload);

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'paymentMethod')).toBe(true);
  });

  it('rejects invalid payment_channel values', async () => {
    const dto = plainToInstance(CreateTripDto, {
      ...basePayload,
      payment_channel: 'card',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'paymentMethod')).toBe(true);
  });
});

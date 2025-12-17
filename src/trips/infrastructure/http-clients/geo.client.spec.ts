import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeoClient } from './geo.client.js';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
import { H3CacheService } from '../../../shared/cache/h3-cache.service.js';
import { H3Request, H3Response } from './geo.types.js';

describe('GeoClient - h3Encode Order Preservation', () => {
  let geoClient: GeoClient;
  let httpService: jest.Mocked<HttpService>;
  let h3Cache: jest.Mocked<H3CacheService>;
  let rateLimiter: jest.Mocked<TokenBucketRateLimiter>;

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'GEO_SERVICE_URL') {
          return 'http://localhost:3000/geo';
        }
        return undefined;
      }),
    };

    const mockServiceTokenService = {
      getServiceHeaders: jest.fn(() => ({
        'X-JWT-Payload': 'mock-jwt-payload',
      })),
      generateServicePayload: jest.fn(() => 'mock-payload'),
    };

    const mockRateLimiter = {
      acquire: jest.fn().mockResolvedValue(undefined),
      createBucket: jest.fn(),
      tryAcquire: jest.fn(() => true),
    };

    const mockH3Cache = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoClient,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ServiceTokenService, useValue: mockServiceTokenService },
        { provide: TokenBucketRateLimiter, useValue: mockRateLimiter },
        { provide: H3CacheService, useValue: mockH3Cache },
      ],
    }).compile();

    geoClient = module.get<GeoClient>(GeoClient);
    httpService = module.get(HttpService);
    h3Cache = module.get(H3CacheService);
    rateLimiter = module.get(TokenBucketRateLimiter);

    // Initialize rate limiter buckets
    geoClient.onModuleInit();
  });

  describe('h3Encode with mixed cache hits and misses', () => {
    it('should preserve exact order when some operations are cached', async () => {
      // Arrange: 4 operations where op[0] and op[2] are cached
      const request: H3Request = {
        ops: [
          { op: 'encode', lat: 40.7128, lng: -74.006, res: 9 }, // op[0] - CACHE HIT
          { op: 'encode', lat: 40.7128, lng: -74.006, res: 7 }, // op[1] - CACHE MISS
          { op: 'encode', lat: 40.7589, lng: -73.9851, res: 9 }, // op[2] - CACHE HIT
          { op: 'encode', lat: 40.7589, lng: -73.9851, res: 7 }, // op[3] - CACHE MISS
        ],
      };

      // Mock cache behavior: op[0] and op[2] are cached
      h3Cache.get.mockImplementation((lat: number, lng: number, res: number) => {
        if (lat === 40.7128 && lng === -74.006 && res === 9) {
          return 'h3-cached-origin-res9'; // op[0]
        }
        if (lat === 40.7589 && lng === -73.9851 && res === 9) {
          return 'h3-cached-dest-res9'; // op[2]
        }
        return undefined; // op[1] and op[3] are not cached
      });

      // Mock remote service response for uncached ops [op[1], op[3]]
      const remoteResponse: H3Response = {
        results: [
          { op: 'encode', h3: 'h3-remote-origin-res7' }, // Response for op[1]
          { op: 'encode', h3: 'h3-remote-dest-res7' }, // Response for op[3]
        ],
      };

      httpService.post.mockResolvedValueOnce(remoteResponse);

      // Act
      const result = await geoClient.h3Encode(request);

      // Assert: Order must match exactly with request.ops
      expect(result.results).toHaveLength(4);

      // Verify exact order preservation
      expect(result.results[0]).toEqual({
        op: 'encode',
        h3: 'h3-cached-origin-res9', // From cache (op[0])
      });
      expect(result.results[1]).toEqual({
        op: 'encode',
        h3: 'h3-remote-origin-res7', // From remote (op[1])
      });
      expect(result.results[2]).toEqual({
        op: 'encode',
        h3: 'h3-cached-dest-res9', // From cache (op[2])
      });
      expect(result.results[3]).toEqual({
        op: 'encode',
        h3: 'h3-remote-dest-res7', // From remote (op[3])
      });

      // Verify remote service was called only with uncached ops
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:3000/geo/h3/encode',
        {
          ops: [
            { op: 'encode', lat: 40.7128, lng: -74.006, res: 7 }, // op[1]
            { op: 'encode', lat: 40.7589, lng: -73.9851, res: 7 }, // op[3]
          ],
        },
        expect.any(Object),
      );

      // Verify cache was updated for remote results
      expect(h3Cache.set).toHaveBeenCalledWith(
        40.7128,
        -74.006,
        7,
        'h3-remote-origin-res7',
      );
      expect(h3Cache.set).toHaveBeenCalledWith(
        40.7589,
        -73.9851,
        7,
        'h3-remote-dest-res7',
      );
    });

    it('should preserve order with all cache hits', async () => {
      // Arrange: All operations cached
      const request: H3Request = {
        ops: [
          { op: 'encode', lat: 40.7128, lng: -74.006, res: 9 },
          { op: 'encode', lat: 40.7589, lng: -73.9851, res: 9 },
        ],
      };

      h3Cache.get.mockImplementation((lat: number, lng: number, res: number) => {
        if (lat === 40.7128 && lng === -74.006 && res === 9) {
          return 'h3-cached-1';
        }
        if (lat === 40.7589 && lng === -73.9851 && res === 9) {
          return 'h3-cached-2';
        }
        return undefined;
      });

      // Act
      const result = await geoClient.h3Encode(request);

      // Assert
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({ op: 'encode', h3: 'h3-cached-1' });
      expect(result.results[1]).toEqual({ op: 'encode', h3: 'h3-cached-2' });

      // Remote service should NOT be called
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should preserve order with all cache misses', async () => {
      // Arrange: No operations cached
      const request: H3Request = {
        ops: [
          { op: 'encode', lat: 40.7128, lng: -74.006, res: 9 },
          { op: 'encode', lat: 40.7589, lng: -73.9851, res: 9 },
        ],
      };

      h3Cache.get.mockReturnValue(undefined); // All cache misses

      const remoteResponse: H3Response = {
        results: [
          { op: 'encode', h3: 'h3-remote-1' },
          { op: 'encode', h3: 'h3-remote-2' },
        ],
      };

      httpService.post.mockResolvedValueOnce(remoteResponse);

      // Act
      const result = await geoClient.h3Encode(request);

      // Assert
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({ op: 'encode', h3: 'h3-remote-1' });
      expect(result.results[1]).toEqual({ op: 'encode', h3: 'h3-remote-2' });

      // Verify remote service was called with all ops
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:3000/geo/h3/encode',
        { ops: request.ops },
        expect.any(Object),
      );
    });

    it('should preserve order with alternating cache hits and misses', async () => {
      // Arrange: Alternating pattern - miss, hit, miss, hit
      const request: H3Request = {
        ops: [
          { op: 'encode', lat: 1.0, lng: 1.0, res: 9 }, // op[0] - MISS
          { op: 'encode', lat: 2.0, lng: 2.0, res: 9 }, // op[1] - HIT
          { op: 'encode', lat: 3.0, lng: 3.0, res: 9 }, // op[2] - MISS
          { op: 'encode', lat: 4.0, lng: 4.0, res: 9 }, // op[3] - HIT
        ],
      };

      h3Cache.get.mockImplementation((lat: number) => {
        if (lat === 2.0) return 'h3-cached-2';
        if (lat === 4.0) return 'h3-cached-4';
        return undefined;
      });

      const remoteResponse: H3Response = {
        results: [
          { op: 'encode', h3: 'h3-remote-1' }, // For op[0]
          { op: 'encode', h3: 'h3-remote-3' }, // For op[2]
        ],
      };

      httpService.post.mockResolvedValueOnce(remoteResponse);

      // Act
      const result = await geoClient.h3Encode(request);

      // Assert: Verify exact alternating order
      expect(result.results).toHaveLength(4);
      expect(result.results[0]).toEqual({ op: 'encode', h3: 'h3-remote-1' });
      expect(result.results[1]).toEqual({ op: 'encode', h3: 'h3-cached-2' });
      expect(result.results[2]).toEqual({ op: 'encode', h3: 'h3-remote-3' });
      expect(result.results[3]).toEqual({ op: 'encode', h3: 'h3-cached-4' });
    });
  });
});

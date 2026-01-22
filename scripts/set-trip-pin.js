const { randomBytes, pbkdf2Sync } = require('crypto');
const Redis = require('ioredis');

const HASH_ITERATIONS = 100000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = 'sha512';
const DEFAULT_TTL_SECONDS = 900;

const [tripId, pinArg] = process.argv.slice(2);

if (!tripId) {
  // eslint-disable-next-line no-console
  console.error('Usage: node scripts/set-trip-pin.js <tripId> [pin]');
  process.exit(1);
}

const pin = pinArg || '1234';
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  // eslint-disable-next-line no-console
  console.error('REDIS_URL is required');
  process.exit(1);
}

const ttlSeconds = Number(process.env.PIN_TTL_SECONDS || DEFAULT_TTL_SECONDS);

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const main = async () => {
  const pinKey = `trip:${tripId}:pin`;
  const attemptsKey = `trip:${tripId}:pin:attempts`;
  const blockedKey = `trip:${tripId}:pin:blocked`;

  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(pin, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST).toString('hex');
  const storedValue = `${salt}:${hash}`;

  await redis.set(pinKey, storedValue, 'EX', ttlSeconds);
  await redis.del(attemptsKey, blockedKey);

  // eslint-disable-next-line no-console
  console.log(`PIN set for trip ${tripId}: ${pin}`);
};

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to set PIN:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await redis.quit();
  });

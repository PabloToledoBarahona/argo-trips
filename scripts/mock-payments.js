const http = require('http');
const { randomUUID } = require('crypto');

const port = Number(process.env.MOCK_PAYMENTS_PORT || 3007);

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    if (!raw) return resolve({});
    try {
      resolve(JSON.parse(raw));
    } catch (error) {
      reject(error);
    }
  });
});

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  if (!url) {
    return sendJson(res, 400, { error: 'Missing URL' });
  }

  if (method === 'GET' && url === '/healthz') {
    return sendJson(res, 200, { status: 'healthy', service: 'mock-payments' });
  }

  if (method === 'POST' && url === '/payments/intents') {
    try {
      await readJsonBody(req);
      const paymentIntentId = `pi_${randomUUID()}`;
      return sendJson(res, 200, {
        paymentIntentId,
        status: 'requires_capture',
        clientSecret: `secret_${paymentIntentId}`,
      });
    } catch (error) {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
  }

  if (method === 'GET' && url.startsWith('/payments/intents/')) {
    const paymentIntentId = url.split('/').pop() || `pi_${randomUUID()}`;
    return sendJson(res, 200, {
      paymentIntentId,
      status: 'succeeded',
    });
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock payments listening on http://localhost:${port}`);
});

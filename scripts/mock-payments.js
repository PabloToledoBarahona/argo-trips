const http = require('http');
const { randomUUID } = require('crypto');

const port = Number(process.env.MOCK_PAYMENTS_PORT || 3007);
const intents = new Map();

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

  if (method === 'POST' && url === '/payments/intents') {
    try {
      const body = await readJsonBody(req);
      const paymentIntentId = `pi_${randomUUID()}`;
      const status = 'requires_capture';
      const clientSecret = `secret_${paymentIntentId}`;

      intents.set(paymentIntentId, {
        ...body,
        paymentIntentId,
        status,
        clientSecret,
      });

      return sendJson(res, 201, { paymentIntentId, status, clientSecret });
    } catch (error) {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
  }

  if (method === 'GET' && url.startsWith('/payments/intents/')) {
    const paymentIntentId = url.replace('/payments/intents/', '');
    const intent = intents.get(paymentIntentId);
    if (!intent) {
      return sendJson(res, 404, { error: 'Payment intent not found' });
    }
    return sendJson(res, 200, {
      paymentIntentId,
      status: intent.status,
    });
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock Payments listening on http://localhost:${port}`);
});

const http = require('http');
const { randomUUID } = require('crypto');

const port = Number(process.env.MOCK_DEPS_PORT || 4001);

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

  if (method === 'POST' && url === '/auth/admin/login') {
    return sendJson(res, 200, {
      access_token: `mock-${randomUUID()}`,
      expires_in: 3600,
    });
  }

  if (method === 'POST' && url === '/geo/h3/encode') {
    try {
      const body = await readJsonBody(req);
      const results = (body.ops || []).map((op, index) => {
        if (op.op === 'encode') {
          return {
            op: 'encode',
            h3: `mock-h3-${op.res || 9}-${index}`,
          };
        }
        if (op.op === 'kRing') {
          return {
            op: 'kRing',
            cells: [op.h3 || 'mock-h3'],
          };
        }
        return { op: op.op || 'unknown', error: 'unsupported op' };
      });
      return sendJson(res, 200, { results });
    } catch (error) {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
  }

  if (method === 'POST' && url === '/geo/route') {
    try {
      const body = await readJsonBody(req);
      return sendJson(res, 200, {
        engine: 'mock',
        duration_sec: 420,
        distance_m: 2500,
        polyline: null,
        waypoints: [body.origin, body.destination].filter(Boolean),
        h3_path_res9: [],
        from_cache: false,
        degradation: null,
      });
    } catch (error) {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
  }

  if (method === 'POST' && url === '/geo/eta') {
    return sendJson(res, 200, {
      engine: 'mock',
      pairs: [
        {
          o: 0,
          d: 0,
          duration_sec: 300,
          distance_m: 2000,
          from_cache: false,
        },
      ],
      degradation: null,
    });
  }

  if (method === 'POST' && url === '/pricing/quote') {
    try {
      await readJsonBody(req);
      const quoteId = `qt_${randomUUID()}`;
      return sendJson(res, 200, {
        quote_id: quoteId,
        currency: 'BOB',
        estimate_total: 20.5,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        degradation: null,
        breakdown: {
          base: 6,
          per_km: { rate: 2.5, distance_km: 3, amount: 7.5 },
          per_min: { rate: 0.4, duration_min: 6, amount: 2.4 },
          multipliers: { vehicle: 1, surge: 1, time: 1 },
          extras: [],
          min_fare: 10,
          rounded_step: 0.5,
        },
        zone: { h3_res7: 'mock-h3-res7', surge: 1 },
      });
    } catch (error) {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
  }

  if (method === 'POST' && url === '/pricing/finalize') {
    try {
      const body = await readJsonBody(req);
      return sendJson(res, 200, {
        trip_id: body.trip_id || `trp_${randomUUID()}`,
        currency: 'BOB',
        total_final: 21,
        taxes: [],
        surge_used: 1,
        min_fare_applied: false,
        cancel_fee_applied: false,
        pricing_rule_version: 'mock',
        degradation: null,
      });
    } catch (error) {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }
  }

  if (method === 'GET' && url.startsWith('/driver-sessions/sessions/')) {
    const driverId = url.split('/').pop();
    return sendJson(res, 200, {
      driver_id: driverId,
      online: true,
      last_loc: {
        lat: -17.78345,
        lng: -63.18117,
        h3_res9: 'mock-h3-res9',
        speed_mps: 0,
        heading_deg: 0,
        ts: new Date().toISOString(),
      },
      trip_id: null,
      eligibility: { ok: true, status: 'ACTIVE' },
    });
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock deps listening on http://localhost:${port}`);
});

require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { sha256 } = require('./utils/hash');
const { sendToDag } = require('./services/dag');
const { sendToWeb3 } = require('./services/web3');
const { sendToAI } = require('./services/ai');

const app = express();
app.use(express.json());

// Simple CORS middleware (allow all origins for MVP)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Temporary in-memory store (will be persisted to data.json)
const sensorData = [];
const DATA_FILE = path.join(__dirname, 'data.json');

// Load persisted data if available
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) sensorData.push(...parsed);
    console.log(`Loaded ${sensorData.length} records from data.json`);
  }
} catch (err) {
  console.error('Failed to load data.json:', err && err.message ? err.message : err);
}

// SSE clients
let sseClients = [];

function broadcastEvent(record) {
  const payload = `data: ${JSON.stringify(record)}\n\n`;
  sseClients.forEach((res) => {
    try { res.write(payload); } catch (e) { /* ignore */ }
  });
}

// Endpoint to ingest sensor data
app.post('/ingest', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.timestamp) {
    return res.status(400).json({ error: 'Invalid payload. Expecting { temperature, humidity, location, timestamp }' });
  }

  // Compute hash for the payload (deterministic from the payload content)
  const hash = sha256(payload);

  // store the payload along with its hash and receivedAt timestamp
  const stored = Object.assign({}, payload, { hash, receivedAt: new Date().toISOString() });
  sensorData.push(stored);

  // Persist to disk (overwrite entire file - fine for MVP)
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(sensorData, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write data.json:', err && err.message ? err.message : err);
  }

  // Fire-and-forget integration calls to stubs (non-blocking)
  // Real integrations should handle retries, failures, batching, and idempotency
  (async () => {
    try {
      await sendToDag(stored);
    } catch (err) {
      console.error('dag send error', err && err.message ? err.message : err);
    }
  })();

  (async () => {
    try {
      await sendToWeb3(stored);
    } catch (err) {
      console.error('web3 send error', err && err.message ? err.message : err);
    }
  })();

  (async () => {
    try {
      await sendToAI(stored);
    } catch (err) {
      console.error('ai send error', err && err.message ? err.message : err);
    }
  })();

  // broadcast to SSE clients
  try { broadcastEvent(stored); } catch (e) { /* ignore */ }

  // Return acknowledgement including the computed hash
  res.json({ status: 'ok', stored });
});

// Endpoint to retrieve all data
// Helper: apply filters & sorting
function applyFilters(q) {
  const limit = Math.max(1, Math.min(1000, parseInt(q.limit || '50', 10) || 50));
  const offset = Math.max(0, parseInt(q.offset || '0', 10) || 0);

  let results = sensorData.slice();
  // sort by receivedAt desc (newest first)
  results.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

  // time range filter
  if (q.from) {
    const fromTs = new Date(q.from).getTime();
    if (!isNaN(fromTs)) results = results.filter(r => new Date(r.timestamp).getTime() >= fromTs);
  }
  if (q.to) {
    const toTs = new Date(q.to).getTime();
    if (!isNaN(toTs)) results = results.filter(r => new Date(r.timestamp).getTime() <= toTs);
  }

  // numeric filters
  if (q.minTemp) {
    const v = parseFloat(q.minTemp);
    if (!isNaN(v)) results = results.filter(r => parseFloat(r.temperature) >= v);
  }
  if (q.maxTemp) {
    const v = parseFloat(q.maxTemp);
    if (!isNaN(v)) results = results.filter(r => parseFloat(r.temperature) <= v);
  }
  if (q.minHumidity) {
    const v = parseFloat(q.minHumidity);
    if (!isNaN(v)) results = results.filter(r => parseFloat(r.humidity) >= v);
  }
  if (q.maxHumidity) {
    const v = parseFloat(q.maxHumidity);
    if (!isNaN(v)) results = results.filter(r => parseFloat(r.humidity) <= v);
  }

  // location filter: center + radius (km)
  if (q.centerLat && q.centerLon && q.radius) {
    const centerLat = parseFloat(q.centerLat);
    const centerLon = parseFloat(q.centerLon);
    const radiusKm = parseFloat(q.radius);
    if (!isNaN(centerLat) && !isNaN(centerLon) && !isNaN(radiusKm)) {
      const toRad = (d) => d * Math.PI / 180;
      const haversineKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // earth km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };
      results = results.filter(r => {
        const lat = parseFloat(r.location && r.location.lat);
        const lon = parseFloat(r.location && r.location.lon);
        if (isNaN(lat) || isNaN(lon)) return false;
        const d = haversineKm(centerLat, centerLon, lat, lon);
        return d <= radiusKm;
      });
    }
  }

  const total = results.length;
  const page = results.slice(offset, offset + limit);
  return { total, limit, offset, results: page };
}

app.get('/data', (req, res) => {
  const out = applyFilters(req.query);
  res.json(out);
});

// Export CSV using same filters
app.get('/export.csv', (req, res) => {
  try {
    const q = req.query || {};
    // get full filtered results (ignore pagination for export)
    const all = sensorData.slice().sort((a,b)=> new Date(b.receivedAt) - new Date(a.receivedAt));

    // reuse filtering logic by temporarily using applyFilters but with large limit
    const fakeQuery = Object.assign({}, q, { limit: String(all.length), offset: '0' });
    const filtered = applyFilters(fakeQuery).results;

    // CSV header
    const header = ['timestamp', 'temperature', 'humidity', 'lat', 'lon', 'hash', 'receivedAt'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="twin-data-${Date.now()}.csv"`);
    res.write(header.join(',') + '\n');
    filtered.forEach(r => {
      const row = [
        r.timestamp,
        r.temperature,
        r.humidity,
        (r.location && r.location.lat) || '',
        (r.location && r.location.lon) || '',
        r.hash || '',
        r.receivedAt || ''
      ];
      // escape commas/newlines by wrapping with quotes if needed
      const safe = row.map(v => {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      });
      res.write(safe.join(',') + '\n');
    });
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate CSV', detail: err && err.message });
  }
});

// Server-Sent Events endpoint for realtime updates
app.get('/events', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // Send a comment to keep connection alive
  res.write(': connected\n\n');

  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});
// Serve frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Get port from environment or use default
// For Railway/Render deployment, use PORT env variable
const HTTP_PORT = process.env.PORT || process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true' || false;

// Start HTTP server
http.createServer(app).listen(HTTP_PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(`║         🌐 TWINLOGY IDN Server Started 🌐           ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝`);
  console.log(`📡 HTTP  → http://localhost:${HTTP_PORT}`);
});

// Try to start HTTPS server if certificates are available
const sslKeyPath = path.join(__dirname, 'ssl', 'server.key');
const sslCertPath = path.join(__dirname, 'ssl', 'server.cert');

if (ENABLE_HTTPS || (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath))) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath)
    };
    
    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
      console.log(`🔐 HTTPS → https://localhost:${HTTPS_PORT}`);
      console.log(`   ✓ SSL Certificate Active (Self-Signed)`);
      console.log(`\n🌐 Custom Domains Available:`);
      console.log(`   • https://twinlogy-idn.local:${HTTPS_PORT}`);
      console.log(`   • https://twinlogy-idn.com:${HTTPS_PORT}`);
      console.log(`\n💡 Environment: ${NODE_ENV}`);
      console.log(`📊 Loaded ${sensorData.length} sensor records`);
      console.log(`\n💡 Setup custom domain: npm run setup-domain (as Admin)\n`);
    });
  } catch (err) {
    console.warn('⚠️  HTTPS server failed to start:', err.message);
    console.log('   💡 Run "npm run gen-cert" to create SSL certificates\n');
  }
} else {
  console.log('ℹ️  HTTPS disabled. To enable:');
  console.log('   1. Run: npm run gen-cert');
  console.log('   2. Restart server (auto-detect certificate)\n');
}

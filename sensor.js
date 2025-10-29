const http = require('http');
const https = require('https');

// Configuration: Set USE_HTTPS=true to connect via HTTPS
const USE_HTTPS = process.env.USE_HTTPS === 'true' || false;
const HOST = 'localhost';
const PORT = USE_HTTPS ? 3443 : 3000;
const PROTOCOL = USE_HTTPS ? 'https' : 'http';

// Expanded sensor network across Indonesia
const SENSOR_LOCATIONS = [
  // Jakarta & surrounding (Jabodetabek)
  { name: 'Jakarta Pusat', lat: -6.200, lon: 106.816, spread: 0.02 },
  { name: 'Jakarta Selatan', lat: -6.261, lon: 106.810, spread: 0.02 },
  { name: 'Jakarta Utara', lat: -6.138, lon: 106.863, spread: 0.02 },
  { name: 'Tangerang', lat: -6.178, lon: 106.630, spread: 0.015 },
  { name: 'Bekasi', lat: -6.238, lon: 107.001, spread: 0.015 },
  { name: 'Depok', lat: -6.402, lon: 106.794, spread: 0.012 },
  { name: 'Bogor', lat: -6.595, lon: 106.799, spread: 0.015 },
  
  // West Java
  { name: 'Bandung', lat: -6.914, lon: 107.609, spread: 0.025 },
  { name: 'Cirebon', lat: -6.732, lon: 108.552, spread: 0.012 },
  { name: 'Tasikmalaya', lat: -7.327, lon: 108.220, spread: 0.010 },
  
  // Central Java
  { name: 'Semarang', lat: -6.993, lon: 110.420, spread: 0.020 },
  { name: 'Solo', lat: -7.556, lon: 110.831, spread: 0.015 },
  { name: 'Yogyakarta', lat: -7.797, lon: 110.370, spread: 0.018 },
  { name: 'Purwokerto', lat: -7.427, lon: 109.234, spread: 0.010 },
  
  // East Java
  { name: 'Surabaya', lat: -7.250, lon: 112.750, spread: 0.025 },
  { name: 'Malang', lat: -7.966, lon: 112.633, spread: 0.018 },
  { name: 'Kediri', lat: -7.816, lon: 112.017, spread: 0.010 },
  
  // Bali & Nusa Tenggara
  { name: 'Denpasar', lat: -8.670, lon: 115.212, spread: 0.020 },
  { name: 'Mataram', lat: -8.583, lon: 116.116, spread: 0.012 },
  
  // Sumatra
  { name: 'Medan', lat: 3.595, lon: 98.672, spread: 0.022 },
  { name: 'Palembang', lat: -2.990, lon: 104.756, spread: 0.018 },
  { name: 'Padang', lat: -0.947, lon: 100.417, spread: 0.015 },
  { name: 'Pekanbaru', lat: 0.533, lon: 101.447, spread: 0.015 },
  { name: 'Lampung', lat: -5.429, lon: 105.262, spread: 0.012 },
  
  // Kalimantan
  { name: 'Banjarmasin', lat: -3.316, lon: 114.590, spread: 0.015 },
  { name: 'Pontianak', lat: -0.026, lon: 109.342, spread: 0.013 },
  { name: 'Balikpapan', lat: -1.267, lon: 116.828, spread: 0.013 },
  
  // Sulawesi
  { name: 'Makassar', lat: -5.147, lon: 119.432, spread: 0.020 },
  { name: 'Manado', lat: 1.474, lon: 124.842, spread: 0.015 },
  
  // Papua & Maluku
  { name: 'Jayapura', lat: -2.533, lon: 140.717, spread: 0.012 },
  { name: 'Ambon', lat: -3.695, lon: 128.181, spread: 0.010 }
];

let sensorIdCounter = 1000;

function randomInRange(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function getRandomLocation() {
  return SENSOR_LOCATIONS[Math.floor(Math.random() * SENSOR_LOCATIONS.length)];
}

function makeSample() {
  const baseLocation = getRandomLocation();
  
  // Generate location with some spread around the base point
  const lat = baseLocation.lat + (Math.random() - 0.5) * baseLocation.spread;
  const lon = baseLocation.lon + (Math.random() - 0.5) * baseLocation.spread;
  
  return {
    sensorId: `TWIN-${String(sensorIdCounter++).padStart(6, '0')}`,
    locationName: baseLocation.name,
    temperature: randomInRange(20, 35),
    humidity: randomInRange(40, 90),
    location: {
      lat: lat.toFixed(6),
      lon: lon.toFixed(6)
    },
    timestamp: new Date().toISOString()
  };
}

function send(sample) {
  const data = JSON.stringify(sample);

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/ingest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    },
    // For self-signed certificates in development, disable certificate validation
    rejectUnauthorized: false
  };

  // Use appropriate protocol
  const protocol = USE_HTTPS ? https : http;
  
  const req = protocol.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        console.log('Server ack:', parsed.status || parsed);
      } catch (err) {
        console.log('Server resp:', body);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Request error:', err.message);
  });

  req.write(data);
  req.end();
}

function start(intervalMs = 5000) {
  const icon = USE_HTTPS ? '🔐' : '🌐';
  console.log(`\n╔═════════════════════════════════════════════════════════╗`);
  console.log(`║      ${icon} TWINLOGY IDN Sensor Network ${icon}            ║`);
  console.log(`╚═════════════════════════════════════════════════════════╝`);
  console.log(`📡 Target: ${PROTOCOL}://${HOST}:${PORT}/ingest`);
  console.log(`⏱️  Interval: ${intervalMs}ms (${intervalMs/1000}s)`);
  console.log(`🌍 Coverage: 31 cities across Indonesia`);
  if (USE_HTTPS) {
    console.log(`🔐 HTTPS Mode: Active (self-signed cert validation disabled)`);
  }
  console.log(`\n📊 Starting data transmission...\n`);
  send(makeSample());
  setInterval(() => send(makeSample()), intervalMs);
}

// If run directly
if (require.main === module) {
  start(5000);
}

module.exports = { start };

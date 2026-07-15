const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 3600 });
let lastCallTime = 0;
const DELAY_MS = parseInt(process.env.NOMINATIM_DELAY_MS) || 1100;

async function enforceDelay() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < DELAY_MS) {
    await new Promise(r => setTimeout(r, DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
}

async function geocode(query) {
  const cacheKey = `geocode:${query.toLowerCase().trim()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  await enforceDelay();

  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: query,
      format: 'json',
      countrycodes: 'in',
      limit: 5,
      addressdetails: 1
    },
    headers: {
      'User-Agent': 'EVPath/1.0 (evpath-app)'
    }
  });

  const results = response.data.map(item => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    type: item.type
  }));

  cache.set(cacheKey, results);
  return results;
}

async function reverseGeocode(lat, lng) {
  const cacheKey = `reverse:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  await enforceDelay();

  const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: { lat, lon: lng, format: 'json' },
    headers: { 'User-Agent': 'EVPath/1.0 (evpath-app)' }
  });

  const result = {
    displayName: response.data.display_name,
    lat,
    lng
  };

  cache.set(cacheKey, result);
  return result;
}

module.exports = { geocode, reverseGeocode };

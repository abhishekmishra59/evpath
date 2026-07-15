const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 3600 });

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const AMENITY_TAGS = {
  foodCourt: ['amenity=restaurant', 'amenity=food_court', 'amenity=fast_food', 'amenity=cafe'],
  restroom: ['amenity=toilets'],
  parking: ['amenity=parking', 'amenity=parking_entrance']
};

async function getAmenitiesNear(lat, lng, radiusM = 500) {
  const cacheKey = `amenities:${lat.toFixed(3)},${lng.toFixed(3)},${radiusM}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const allTags = Object.values(AMENITY_TAGS).flat();
  const nodeQueries = allTags.map(tag => `node["${tag.replace('=', '"="')}"](around:${radiusM},${lat},${lng});`).join('\n    ');

  const query = `
    [out:json][timeout:10];
    (
      ${nodeQueries}
    );
    out body;
  `;

  await new Promise(r => setTimeout(r, 2000));

  const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const elements = response.data.elements || [];
  const result = classifyAmenities(elements);

  cache.set(cacheKey, result);
  return result;
}

function classifyAmenities(elements) {
  const result = { foodCourt: false, restroom: false, parking: false, items: [] };

  for (const el of elements) {
    const amenity = el.tags?.amenity;
    if (!amenity) continue;

    if (['restaurant', 'food_court', 'fast_food', 'cafe'].includes(amenity)) {
      result.foodCourt = true;
      result.items.push({ type: 'food', name: el.tags?.name || amenity });
    }
    if (amenity === 'toilets') {
      result.restroom = true;
    }
    if (['parking', 'parking_entrance'].includes(amenity)) {
      result.parking = true;
    }
  }

  return result;
}

module.exports = { getAmenitiesNear };

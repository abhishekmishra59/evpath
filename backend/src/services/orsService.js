const axios = require('axios');
const Bottleneck = require('bottleneck');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: parseInt(process.env.ROUTE_CACHE_TTL) || 3600 }); // 1 hour
const limiter = new Bottleneck({ minTime: 1500, maxConcurrent: 1 });

const ORS_BASE = 'https://api.openrouteservice.org/v2';

// ORS maneuver type → display
const MANEUVER_ICONS = {
  0: '↰', 1: '↱', 2: '⬅', 3: '➡', 4: '↖', 5: '↗',
  6: '↑', 7: '🔄', 8: '🔄', 9: '↩', 10: '🏁', 11: '🚦',
  12: '↰', 13: '↱'
};
const MANEUVER_LABELS = {
  0: 'Turn left', 1: 'Turn right', 2: 'Sharp left', 3: 'Sharp right',
  4: 'Keep left', 5: 'Keep right', 6: 'Continue straight', 7: 'Enter roundabout',
  8: 'Exit roundabout', 9: 'U-turn', 10: 'Arrive', 11: 'Depart',
  12: 'Keep left', 13: 'Keep right'
};

async function getRoute(startCoord, endCoord, waypoints = [], options = {}) {
  const {
    avoidTolls = false,
    avoidHighways = false,
    preferHighways = false,
    preference = 'recommended'
  } = options;

  const coords = [
    [startCoord.lng, startCoord.lat],
    ...waypoints.map(w => [w.lng, w.lat]),
    [endCoord.lng, endCoord.lat]
  ];

  const cacheKey = `route:${JSON.stringify({ coords, options })}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const avoidFeatures = [];
  if (avoidTolls) avoidFeatures.push('tollways');
  if (avoidHighways) avoidFeatures.push('highways');

  const body = {
    coordinates: coords,
    instructions: true,
    elevation: false,
    units: 'km',
    preference: avoidHighways ? 'shortest' : (preferHighways ? 'fastest' : preference)
  };

  if (avoidFeatures.length > 0) {
    body.options = { avoid_features: avoidFeatures };
  }

  // Use /geojson endpoint — returns coordinates as [lng, lat] arrays directly
  const response = await limiter.schedule(() =>
    axios.post(`${ORS_BASE}/directions/driving-car/geojson`, body, {
      headers: { Authorization: process.env.ORS_API_KEY, 'Content-Type': 'application/json' }
    })
  );

  const feature = response.data.features[0];
  const props = feature.properties;
  const steps = flattenSteps(props.segments || []);

  const result = {
    distanceKm: Math.round(props.summary.distance * 10) / 10,
    durationMin: Math.round(props.summary.duration / 60),
    geometryCoords: feature.geometry.coordinates,   // [[lng, lat], ...]
    steps
  };

  cache.set(cacheKey, result);
  return result;
}

function flattenSteps(segments) {
  const steps = [];
  for (const seg of segments) {
    for (const step of (seg.steps || [])) {
      steps.push({
        distance: Math.round(step.distance * 10) / 10,
        durationSec: Math.round(step.duration),
        type: step.type,
        icon: MANEUVER_ICONS[step.type] || '↑',
        label: MANEUVER_LABELS[step.type] || 'Continue',
        instruction: step.instruction || '',
        name: step.name || '',
        wayPoints: step.way_points || []
      });
    }
  }
  return steps;
}

module.exports = { getRoute };

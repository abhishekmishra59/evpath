const { getRoute } = require('./orsService');
const { getStationsNear } = require('./ocmService');
const { geocode } = require('./nominatimService');
const ev = require('../utils/evCalculator');
const { generateProsAndCons } = require('../utils/scorer');

const CONNECTOR_ID_MAP = {
  'Type2': 25, 'CCS2': 33, 'CHAdeMO': 2,
  'BharatAC': 1036, 'BharatDC': 1037, 'Type1': 1
};

const CHARGE_TO = { fastest: 80, fewestStops: 90, bestAmenities: 85 };
const LABELS    = { fastest: 'Fastest', fewestStops: 'Fewest Stops', bestAmenities: 'Best Amenities' };

async function planTrip(tripRequest) {
  const {
    origin, destination,
    currentBatteryPct, vehicleRangeKm, batteryCapacityKwh,
    connectorTypes = [], targetBatteryAtDestPct = 20,
    chargeThresholdPct = 20,
    filters = {}, roadOptions = {}
  } = tripRequest;

  const [originResults, destResults] = await Promise.all([
    geocode(origin),
    geocode(destination)
  ]);

  if (!originResults.length) throw new Error(`Could not find location: ${origin}`);
  if (!destResults.length) throw new Error(`Could not find location: ${destination}`);

  const startCoord = { lat: originResults[0].lat, lng: originResults[0].lng };
  const endCoord   = { lat: destResults[0].lat,   lng: destResults[0].lng };
  const connectorIds = connectorTypes.map(t => CONNECTOR_ID_MAP[t]).filter(Boolean);

  // ONE ORS call for the base route — all 3 variants share the same geometry.
  // 3 variants differ only in charging stop strategy, not the road path.
  const baseRoute = await getRoute(startCoord, endCoord, [], roadOptions);

  // Fetch station options once per stop location (shared across all variants)
  const stopIntervals = ev.chargingStopIntervals(baseRoute.distanceKm, vehicleRangeKm, currentBatteryPct, chargeThresholdPct);
  const stationsPerStop = await fetchStationsForStops(
    stopIntervals, baseRoute.geometryCoords, baseRoute.distanceKm, connectorIds
  );

  // Build 3 variants using different charging strategies on the same route
  const routes = ['fastest', 'fewestStops', 'bestAmenities'].map(variant =>
    buildVariant({
      variant, baseRoute, stopIntervals, stationsPerStop,
      currentBatteryPct, vehicleRangeKm, batteryCapacityKwh,
      targetBatteryAtDestPct, chargeThresholdPct, filters, label: LABELS[variant]
    })
  );

  return routes.map(route => {
    const { pros, cons } = generateProsAndCons(route, routes);
    return { ...route, pros, cons };
  });
}

async function fetchStationsForStops(stopIntervals, geometryCoords, totalDistanceKm, connectorIds) {
  const results = [];
  for (const stopInfo of stopIntervals) {
    const fraction = stopInfo.kmFromStart / totalDistanceKm;
    const coord = interpolateAlongRoute(geometryCoords, fraction);
    let stations = [];
    for (const radius of [10, 25, 50]) {
      stations = await getStationsNear(coord.lat, coord.lng, radius, connectorIds);
      if (stations.length >= 1) break;
    }
    results.push({ coord, stations });
  }
  return results;
}

function buildVariant({
  variant, baseRoute, stopIntervals, stationsPerStop,
  currentBatteryPct, vehicleRangeKm, batteryCapacityKwh,
  targetBatteryAtDestPct, chargeThresholdPct = 20, filters, label
}) {
  const chargeTo = CHARGE_TO[variant];
  const chargingStops = [];
  let batteryProfile = [currentBatteryPct];
  let totalChargeTimeMin = 0;

  stopIntervals.forEach((stopInfo, i) => {
    const { coord, stations } = stationsPerStop[i];
    const stationOptions = rankStations(stations, variant, filters).slice(0, 5);
    const selectedStation = stationOptions[0] || null;

    // arrivalBatteryPct is the user-defined threshold — the point they want to stop and charge
    const arrivalBatteryPct = stopInfo.batteryOnArrival ?? chargeThresholdPct;

    const chargerKw = selectedStation?.maxPowerKw || 7.4;
    const chargeTimeMin = ev.estimateChargeTimeMin(arrivalBatteryPct, chargeTo, batteryCapacityKwh, chargerKw);
    const kwhCharged = ((chargeTo - arrivalBatteryPct) / 100) * batteryCapacityKwh;

    totalChargeTimeMin += chargeTimeMin;
    batteryProfile.push(Math.round(arrivalBatteryPct), chargeTo);

    chargingStops.push({
      stopNumber: i + 1,
      kmFromStart: stopInfo.kmFromStart,
      coordOnRoute: coord,
      stationOptions,
      selectedStationIndex: 0,
      station: selectedStation || buildNoStationPlaceholder(coord),
      arrivalBatteryPct: Math.round(arrivalBatteryPct),
      chargeTo,
      estimatedChargeTimeMin: chargeTimeMin,
      kwhCharged: Math.round(kwhCharged * 10) / 10,
      costEstimateINR: ev.estimateTripCost(kwhCharged)
    });
  });

  batteryProfile.push(targetBatteryAtDestPct);
  const maxChargerKw = chargingStops.reduce((mx, s) => Math.max(mx, s.station?.maxPowerKw || 0), 0);

  return {
    id: `route_${variant}`,
    variant,
    label,
    totalDistanceKm: baseRoute.distanceKm,
    totalTimeMin: baseRoute.durationMin + totalChargeTimeMin,
    driveTimeMin: baseRoute.durationMin,
    totalChargeTimeMin,
    chargingStops,
    maxChargerKw,
    batteryProfile,
    geometryCoords: baseRoute.geometryCoords,
    steps: baseRoute.steps
  };
}

function rankStations(stations, variant, filters) {
  let list = stations.filter(s => s.lat && s.lng);

  if (variant === 'bestAmenities') {
    list.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  } else {
    list.sort((a, b) => (b.maxPowerKw || 0) - (a.maxPowerKw || 0));
  }

  // Bump available stations to top
  list.sort((a, b) => {
    const score = s => s.status === 'Available' ? 2 : s.status === 'Busy' ? 1 : 0;
    return score(b) - score(a);
  });

  return list;
}

function buildNoStationPlaceholder(coord) {
  return {
    id: 'unknown', name: 'No station found nearby',
    address: 'Check ChargeZone / Tata Power / Statiq apps for updates',
    lat: coord.lat, lng: coord.lng,
    status: 'Unknown', maxPowerKw: 0, totalPoints: 0,
    isFastCharger: false, connections: [], amenities: {}
  };
}

function interpolateAlongRoute(geometryCoords, fraction) {
  if (!geometryCoords?.length) return { lat: 0, lng: 0 };
  const idx = Math.min(Math.floor(fraction * (geometryCoords.length - 1)), geometryCoords.length - 1);
  const [lng, lat] = geometryCoords[idx];
  return { lat, lng };
}

module.exports = { planTrip };

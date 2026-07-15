function scoreRoute(route, variant) {
  const weights = {
    fastest:      { time: 0.6, stops: 0.2, amenity: 0.1, reliability: 0.1 },
    fewestStops:  { time: 0.2, stops: 0.6, amenity: 0.1, reliability: 0.1 },
    bestAmenities:{ time: 0.2, stops: 0.1, amenity: 0.6, reliability: 0.1 }
  }[variant];

  const timeScore     = 1 / (route.totalTimeMin + 1);
  const stopsScore    = 1 / (route.chargingStops.length + 1);
  const amenityScore  = computeAmenityScore(route.chargingStops);
  const reliabilityScore = computeReliabilityScore(route.chargingStops);

  return (
    weights.time * timeScore +
    weights.stops * stopsScore +
    weights.amenity * amenityScore +
    weights.reliability * reliabilityScore
  );
}

function computeAmenityScore(stops) {
  if (stops.length === 0) return 1;
  const total = stops.reduce((sum, stop) => {
    const a = stop.station.amenities || {};
    return sum + (a.foodCourt ? 1 : 0) + (a.restroom ? 0.5 : 0) + (a.parking ? 0.3 : 0);
  }, 0);
  return Math.min(1, total / (stops.length * 1.8));
}

function computeReliabilityScore(stops) {
  if (stops.length === 0) return 1;
  const availableCount = stops.filter(s => s.station.status === 'Available').length;
  return availableCount / stops.length;
}

function generateProsAndCons(route, allRoutes) {
  const pros = [];
  const cons = [];
  const avgTime = allRoutes.reduce((s, r) => s + r.totalTimeMin, 0) / allRoutes.length;
  const avgStops = allRoutes.reduce((s, r) => s + r.chargingStops.length, 0) / allRoutes.length;
  const avgDist = allRoutes.reduce((s, r) => s + r.totalDistanceKm, 0) / allRoutes.length;

  if (route.totalTimeMin < avgTime * 0.93) {
    pros.push(`Fastest option — saves ~${Math.round(avgTime - route.totalTimeMin)} minutes vs average`);
  }
  if (route.chargingStops.length === 0) {
    pros.push('No charging stops needed — reach destination on current charge');
  }
  if (route.chargingStops.length === 1) {
    pros.push('Only 1 charging stop required');
  }
  if (route.chargingStops.length < avgStops - 0.4) {
    pros.push(`Fewer charging stops (${route.chargingStops.length} vs average ${Math.round(avgStops)})`);
  }
  if (route.maxChargerKw >= 50) {
    pros.push(`Fast DC charging available (${route.maxChargerKw}kW) — quicker stops`);
  }
  const allHaveFood = route.chargingStops.every(s => s.station.amenities?.foodCourt);
  if (allHaveFood && route.chargingStops.length > 0) {
    pros.push('Food available at every charging stop');
  }
  const allHaveRestroom = route.chargingStops.every(s => s.station.amenities?.restroom);
  if (allHaveRestroom && route.chargingStops.length > 0) {
    pros.push('Restrooms available at all stops');
  }
  if (route.chargingStops.every(s => s.station.status === 'Available')) {
    pros.push('All chargers currently showing Available status');
  }

  if (route.totalTimeMin > avgTime * 1.07) {
    cons.push(`Slower route — adds ~${Math.round(route.totalTimeMin - avgTime)} minutes vs average`);
  }
  if (route.chargingStops.length > avgStops + 0.4) {
    cons.push(`More charging stops (${route.chargingStops.length}) than other options`);
  }
  if (route.totalDistanceKm > avgDist * 1.03) {
    cons.push(`Longer route — adds ~${Math.round(route.totalDistanceKm - avgDist)}km`);
  }
  const offlineStops = route.chargingStops.filter(s => s.station.status === 'Offline');
  if (offlineStops.length > 0) {
    cons.push(`${offlineStops.length} charger(s) reported Offline — verify before relying on them`);
  }
  const busyStops = route.chargingStops.filter(s => s.station.status === 'Busy');
  if (busyStops.length > 0) {
    cons.push(`${busyStops.length} charger(s) currently Busy — possible wait time`);
  }
  if (route.maxChargerKw < 22) {
    cons.push(`Only slow AC charging available (${route.maxChargerKw}kW) — longer stops`);
  }
  const stopsWithoutFood = route.chargingStops.filter(s => !s.station.amenities?.foodCourt);
  if (stopsWithoutFood.length > 0 && route.chargingStops.length > 0) {
    cons.push(`No food available at ${stopsWithoutFood.length} charging stop(s)`);
  }

  return { pros, cons };
}

module.exports = { scoreRoute, generateProsAndCons };

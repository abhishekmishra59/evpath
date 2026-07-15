// chargeThresholdPct: user-defined minimum % before they want to start charging (e.g. 20 or 30)
// usable range = how far you can drive from currentBatteryPct down to chargeThresholdPct
function usableRangeKm(vehicleRangeKm, currentBatteryPct, chargeThresholdPct = 10) {
  const usableBatteryPct = Math.max(0, currentBatteryPct - chargeThresholdPct);
  return vehicleRangeKm * (usableBatteryPct / 100);
}

function energyForSegment(distanceKm, elevationGainM, vehicleRangeKm, batteryKwh) {
  const baseConsumptionKwhPerKm = batteryKwh / vehicleRangeKm;
  const elevationPenaltyKwh = (elevationGainM * 0.003) / 1000;
  return distanceKm * baseConsumptionKwhPerKm + elevationPenaltyKwh;
}

function batteryAfterSegment(currentPct, energyKwh, batteryKwh) {
  const percentUsed = (energyKwh / batteryKwh) * 100;
  return Math.max(0, currentPct - percentUsed);
}

function estimateChargeTimeMin(fromPct, toPct, batteryKwh, chargerKw) {
  if (fromPct >= toPct) return 0;
  const kwhNeeded = ((toPct - fromPct) / 100) * batteryKwh;
  const taperFactor = toPct > 80 ? 1.4 : 1.0;
  return Math.round((kwhNeeded / (chargerKw * 0.90)) * 60 * taperFactor);
}

function chargingStopsNeeded(totalDistanceKm, vehicleRangeKm, currentBatteryPct, chargeThresholdPct = 10) {
  const firstLegRange = usableRangeKm(vehicleRangeKm, currentBatteryPct, chargeThresholdPct);
  if (totalDistanceKm <= firstLegRange) return 0;
  const remainingAfterFirst = totalDistanceKm - firstLegRange;
  const fullLegRange = usableRangeKm(vehicleRangeKm, 90, chargeThresholdPct);
  if (fullLegRange <= 0) return 99;
  return 1 + Math.ceil(remainingAfterFirst / fullLegRange);
}

// Returns stop positions: each stop is where the battery reaches chargeThresholdPct
function chargingStopIntervals(totalDistanceKm, vehicleRangeKm, currentBatteryPct, chargeThresholdPct = 10) {
  const stops = [];
  let distanceCovered = 0;
  let battery = currentBatteryPct;
  const MAX_STOPS = 20; // safety cap

  while (distanceCovered < totalDistanceKm && stops.length < MAX_STOPS) {
    const reachableKm = usableRangeKm(vehicleRangeKm, battery, chargeThresholdPct);
    if (reachableKm <= 0) break;

    const nextStop = distanceCovered + reachableKm;
    if (nextStop >= totalDistanceKm) break;

    stops.push({
      kmFromStart: Math.round(nextStop),
      batteryOnArrival: chargeThresholdPct // user arrives exactly at their chosen threshold
    });
    distanceCovered = nextStop;
    battery = 90; // assume charged to 90% at each stop
  }

  return stops;
}

function estimateTripCost(kwhCharged, ratePerKwh = 18) {
  return Math.round(kwhCharged * ratePerKwh);
}

module.exports = {
  usableRangeKm,
  energyForSegment,
  batteryAfterSegment,
  estimateChargeTimeMin,
  chargingStopsNeeded,
  chargingStopIntervals,
  estimateTripCost
};

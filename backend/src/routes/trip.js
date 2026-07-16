const express = require('express');
const router = express.Router();
const { planTrip } = require('../services/routeEngine');

router.post('/plan-trip', async (req, res) => {
  try {
    const {
      origin, destination,
      currentBatteryPct, vehicleRangeKm, batteryCapacityKwh,
      connectorTypes, targetBatteryAtDestPct, chargeThresholdPct,
      filters, roadOptions, waypoints
    } = req.body;

    if (!origin || !destination)
      return res.status(400).json({ error: 'origin and destination are required' });
    if (!currentBatteryPct || !vehicleRangeKm || !batteryCapacityKwh)
      return res.status(400).json({ error: 'currentBatteryPct, vehicleRangeKm, batteryCapacityKwh are required' });

    const routes = await planTrip({
      origin, destination,
      currentBatteryPct:      Number(currentBatteryPct),
      vehicleRangeKm:         Number(vehicleRangeKm),
      batteryCapacityKwh:     Number(batteryCapacityKwh),
      connectorTypes:         connectorTypes || ['CCS2', 'Type2'],
      targetBatteryAtDestPct: Number(targetBatteryAtDestPct || 20),
      chargeThresholdPct:     Number(chargeThresholdPct || 20),
      filters:                filters || {},
      roadOptions:            roadOptions || {},
      waypoints:              Array.isArray(waypoints) ? waypoints.filter(Boolean) : []
    });

    res.json({ routes });
  } catch (err) {
    console.error('plan-trip error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

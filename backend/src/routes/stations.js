const express = require('express');
const router = express.Router();
const { getStationsNear, getStationById } = require('../services/ocmService');

router.get('/stations/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const stations = await getStationsNear(parseFloat(lat), parseFloat(lng), parseFloat(radius));
    res.json({ stations });
  } catch (err) {
    console.error('stations/nearby error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/stations/:id/status', async (req, res) => {
  try {
    const station = await getStationById(req.params.id.replace('ocm_', ''));
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json({
      id: station.id,
      status: station.status,
      totalPoints: station.totalPoints,
      lastStatusUpdate: station.lastStatusUpdate
    });
  } catch (err) {
    console.error('station status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

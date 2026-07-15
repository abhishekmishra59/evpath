const express = require('express');
const router = express.Router();
const { geocode } = require('../services/nominatimService');

router.get('/geocode', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.status(400).json({ error: 'q parameter required (min 2 chars)' });

    const results = await geocode(q.trim());
    res.json({ results });
  } catch (err) {
    console.error('geocode error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

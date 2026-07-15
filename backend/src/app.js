require('dotenv').config();
// Corporate proxy uses SSL inspection — disable cert verification for dev only
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const tripRoutes = require('./routes/trip');
const stationRoutes = require('./routes/stations');
const geocodeRoutes = require('./routes/geocode');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again in a minute.' }
});
app.use('/api/', limiter);

app.use('/api', tripRoutes);
app.use('/api', stationRoutes);
app.use('/api', geocodeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'EVPath', version: '1.0.0' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`EVPath backend running on http://localhost:${PORT}`);
});

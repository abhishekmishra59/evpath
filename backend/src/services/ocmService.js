const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: parseInt(process.env.STATION_CACHE_TTL) || 300 });

const OCM_BASE = 'https://api.openchargemap.io/v3';

const STATUS_MAP = {
  10: 'Available',
  20: 'Busy',
  30: 'Available',
  50: 'Busy',
  75: 'Offline',
  100: 'Offline',
  0: 'Unknown'
};

const CONNECTOR_NAMES = {
  1: 'Type 1 (J1772)',
  2: 'CHAdeMO',
  25: 'Type 2 (Mennekes)',
  33: 'CCS Type 2',
  1036: 'Bharat AC-001',
  1037: 'Bharat DC-001'
};

async function getStationsNear(lat, lng, radiusKm = 10, connectorTypeIds = []) {
  const cacheKey = `stations:${lat.toFixed(3)},${lng.toFixed(3)},${radiusKm},${connectorTypeIds.join('-')}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const params = {
    key: process.env.OCM_API_KEY,
    latitude: lat,
    longitude: lng,
    distance: radiusKm,
    distanceunit: 'KM',
    countrycode: 'IN',
    maxresults: 30,
    compact: true,
    verbose: false
  };

  if (connectorTypeIds.length > 0) {
    params.connectiontypeid = connectorTypeIds.join(',');
  }

  const response = await axios.get(`${OCM_BASE}/poi/`, { params });

  const stations = response.data.map(s => normalizeStation(s));
  cache.set(cacheKey, stations);
  return stations;
}

async function getStationById(id) {
  const cacheKey = `station:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`${OCM_BASE}/poi/`, {
    params: {
      key: process.env.OCM_API_KEY,
      chargepointid: id,
      compact: true,
      verbose: false
    }
  });

  if (!response.data || response.data.length === 0) return null;
  const station = normalizeStation(response.data[0]);
  cache.set(cacheKey, station);
  return station;
}

function normalizeStation(s) {
  const statusId = s.StatusType ? s.StatusType.ID : 0;
  const connections = (s.Connections || []).map(c => ({
    connectorId: c.ConnectionTypeID,
    connectorName: CONNECTOR_NAMES[c.ConnectionTypeID] || c.ConnectionType?.Title || 'Unknown',
    powerKw: c.PowerKW || null,
    currentType: c.CurrentType?.Title || null,
    quantity: c.Quantity || 1
  }));

  const maxPowerKw = connections.reduce((max, c) => Math.max(max, c.powerKw || 0), 0);

  return {
    id: `ocm_${s.ID}`,
    ocmId: s.ID,
    name: s.AddressInfo?.Title || 'Unnamed Station',
    address: [
      s.AddressInfo?.AddressLine1,
      s.AddressInfo?.Town,
      s.AddressInfo?.StateOrProvince
    ].filter(Boolean).join(', '),
    lat: s.AddressInfo?.Latitude,
    lng: s.AddressInfo?.Longitude,
    operatorName: s.OperatorInfo?.Title || null,
    status: STATUS_MAP[statusId] || 'Unknown',
    statusId,
    totalPoints: s.NumberOfPoints || connections.length || 1,
    connections,
    maxPowerKw,
    isFastCharger: maxPowerKw >= 50,
    usageCost: s.UsageCost || null,
    is24Hours: s.AddressInfo?.AccessComments?.toLowerCase().includes('24') || false,
    lastStatusUpdate: s.DateLastStatusUpdate || null,
    distanceKm: s.AddressInfo?.Distance || null
  };
}

module.exports = { getStationsNear, getStationById };

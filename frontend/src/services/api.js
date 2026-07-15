import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 60000
});

export async function planTrip(tripData) {
  const { data } = await api.post('/api/plan-trip', tripData);
  return data.routes;
}

export async function geocodeSearch(query) {
  const { data } = await api.get('/api/geocode', { params: { q: query } });
  return data.results;
}

export async function getStationsNearby(lat, lng, radius = 10) {
  const { data } = await api.get('/api/stations/nearby', { params: { lat, lng, radius } });
  return data.stations;
}

export async function getStationStatus(id) {
  const { data } = await api.get(`/api/stations/${id}/status`);
  return data;
}

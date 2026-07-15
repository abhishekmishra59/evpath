import { useState } from 'react'
import { geocodeSearch } from '../services/api'

const CONNECTOR_OPTIONS = [
  { value: 'CCS2',     label: 'CCS2 (DC Fast)' },
  { value: 'Type2',    label: 'Type 2 (AC)' },
  { value: 'CHAdeMO',  label: 'CHAdeMO' },
  { value: 'BharatDC', label: 'Bharat DC' },
  { value: 'BharatAC', label: 'Bharat AC' }
]

const ROAD_OPTIONS = [
  { value: 'recommended', label: '🗺 Recommended',    desc: 'Balanced route' },
  { value: 'highways',    label: '🛣 Prefer Highways', desc: 'Fastest, use expressways' },
  { value: 'avoidTolls',  label: '💰 Avoid Tolls',    desc: 'Skip toll roads' },
  { value: 'avoidHw',     label: '🏘 Avoid Highways', desc: 'Local & state roads' },
  { value: 'shortest',    label: '📏 Shortest',        desc: 'Minimum distance' }
]

const DEFAULT_FORM = {
  origin: '', destination: '',
  currentBatteryPct: 80, vehicleRangeKm: 400,
  batteryCapacityKwh: 60, targetBatteryAtDestPct: 20,
  chargeThresholdPct: 20,
  connectorTypes: ['CCS2', 'Type2'],
  roadPreference: 'recommended',
  filters: { foodCourt: false, restroom: false, parking: false, fastChargerOnly: false, open24x7: false }
}

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm]           = useState(DEFAULT_FORM)
  const [locating, setLocating]   = useState(false)
  const [suggestions, setSuggestions] = useState({ origin: [], dest: [] })

  function set(field, value) { setForm(p => ({ ...p, [field]: value })) }
  function setFilter(f) { setForm(p => ({ ...p, filters: { ...p.filters, [f]: !p.filters[f] } })) }
  function toggleConnector(v) {
    setForm(p => ({
      ...p,
      connectorTypes: p.connectorTypes.includes(v)
        ? p.connectorTypes.filter(c => c !== v)
        : [...p.connectorTypes, v]
    }))
  }

  async function fetchSuggestions(q, field) {
    if (q.length < 3) return setSuggestions(p => ({ ...p, [field]: [] }))
    try {
      const results = await geocodeSearch(q)
      setSuggestions(p => ({ ...p, [field]: results.slice(0, 4) }))
    } catch (_) {}
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return alert('Geolocation not supported by your browser')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'EVPath/1.0' } }
          )
          const data = await res.json()
          set('origin', data.display_name?.split(',').slice(0, 3).join(',') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        } catch (_) {
          set('origin', `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        }
        setLocating(false)
      },
      err => { alert('Could not get location: ' + err.message); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function buildRoadOptions() {
    return {
      avoidTolls:     form.roadPreference === 'avoidTolls',
      avoidHighways:  form.roadPreference === 'avoidHw',
      preferHighways: form.roadPreference === 'highways',
      preference:     form.roadPreference === 'shortest' ? 'shortest' : 'recommended'
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.origin.trim() || !form.destination.trim()) return
    onSubmit({ ...form, roadOptions: buildRoadOptions() })
  }

  return (
    <form onSubmit={handleSubmit} className="trip-form">
      <div className="form-header">
        <span className="logo">⚡</span>
        <h1>EVPath</h1>
        <p>Plan your EV trip across India</p>
      </div>

      <div className="form-section-label">Route</div>

      {/* Origin */}
      <div className="form-group location-group">
        <label>From</label>
        <div className="location-input-row">
          <input
            type="text"
            placeholder="e.g. Bangalore, Karnataka"
            value={form.origin}
            onChange={e => { set('origin', e.target.value); fetchSuggestions(e.target.value, 'origin') }}
            onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, origin: [] })), 200)}
            required
          />
          <button type="button" className="btn-gps" onClick={useCurrentLocation} disabled={locating} title="Use my current location">
            {locating ? '…' : '📍'}
          </button>
        </div>
        {suggestions.origin.length > 0 && (
          <ul className="suggestions">
            {suggestions.origin.map((s, i) => (
              <li key={i} onMouseDown={() => { set('origin', s.displayName); setSuggestions(p => ({ ...p, origin: [] })) }}>
                {s.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Destination */}
      <div className="form-group location-group">
        <label>To</label>
        <input
          type="text"
          placeholder="e.g. Hyderabad, Telangana"
          value={form.destination}
          onChange={e => { set('destination', e.target.value); fetchSuggestions(e.target.value, 'dest') }}
          onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, dest: [] })), 200)}
          required
        />
        {suggestions.dest.length > 0 && (
          <ul className="suggestions">
            {suggestions.dest.map((s, i) => (
              <li key={i} onMouseDown={() => { set('destination', s.displayName); setSuggestions(p => ({ ...p, dest: [] })) }}>
                {s.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="form-section-label">Vehicle &amp; Battery</div>

      {/* Battery sliders */}
      <div className="form-row">
        <div className="form-group">
          <label>Current Battery</label>
          <div className="range-with-value">
            <input type="range" min="10" max="100" step="5" value={form.currentBatteryPct}
              onChange={e => set('currentBatteryPct', +e.target.value)} />
            <span className="range-value">{form.currentBatteryPct}%</span>
          </div>
        </div>
        <div className="form-group">
          <label>Arrive with ≥</label>
          <div className="range-with-value">
            <input type="range" min="10" max="50" step="5" value={form.targetBatteryAtDestPct}
              onChange={e => set('targetBatteryAtDestPct', +e.target.value)} />
            <span className="range-value">{form.targetBatteryAtDestPct}%</span>
          </div>
        </div>
      </div>

      {/* Charge threshold */}
      <div className="form-group">
        <label>Start charging when battery drops to</label>
        <div className="range-with-value">
          <input
            type="range" min="5" max="40" step="5"
            value={form.chargeThresholdPct}
            onChange={e => set('chargeThresholdPct', +e.target.value)}
          />
          <span className="range-value">{form.chargeThresholdPct}%</span>
        </div>
        <div className="threshold-hint">
          {form.chargeThresholdPct <= 10 && '⚠ Very low — risky on long stretches without chargers'}
          {form.chargeThresholdPct >= 11 && form.chargeThresholdPct <= 20 && '✓ Comfortable buffer — good for highway trips'}
          {form.chargeThresholdPct >= 25 && form.chargeThresholdPct <= 30 && '⚡ Cautious — more stops but less range anxiety'}
          {form.chargeThresholdPct >= 35 && '🔒 Very conservative — maximum safety, most stops'}
        </div>
      </div>

      {/* Vehicle specs */}
      <div className="form-row">
        <div className="form-group">
          <label>Full Range (km)</label>
          <input type="number" min="50" max="800" step="10" value={form.vehicleRangeKm}
            onChange={e => set('vehicleRangeKm', +e.target.value)} />
        </div>
        <div className="form-group">
          <label>Battery (kWh)</label>
          <input type="number" min="10" max="200" step="1" value={form.batteryCapacityKwh}
            onChange={e => set('batteryCapacityKwh', +e.target.value)} />
        </div>
      </div>

      <div className="form-section-label">Charger Preferences</div>

      {/* Connectors */}
      <div className="form-group">
        <label>Connector Types</label>
        <div className="connector-chips">
          {CONNECTOR_OPTIONS.map(o => (
            <button key={o.value} type="button"
              className={`chip ${form.connectorTypes.includes(o.value) ? 'chip-active' : ''}`}
              onClick={() => toggleConnector(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Road preference */}
      <div className="form-group">
        <label>Route Type</label>
        <div className="road-options">
          {ROAD_OPTIONS.map(o => (
            <label key={o.value} className={`road-option ${form.roadPreference === o.value ? 'road-active' : ''}`}>
              <input type="radio" name="road" value={o.value} checked={form.roadPreference === o.value}
                onChange={() => set('roadPreference', o.value)} />
              <span className="road-label">{o.label}</span>
              <span className="road-desc">{o.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Amenity filters */}
      <div className="form-group">
        <label>Station Amenity Filters</label>
        <div className="filter-grid">
          {[
            { key: 'foodCourt',       label: '🍽 Food Court' },
            { key: 'restroom',        label: '🚻 Restroom' },
            { key: 'parking',         label: '🅿 Parking' },
            { key: 'fastChargerOnly', label: '⚡ Fast Charger Only' },
            { key: 'open24x7',        label: '🕐 Open 24×7' }
          ].map(f => (
            <label key={f.key} className="filter-check">
              <input type="checkbox" checked={form.filters[f.key]} onChange={() => setFilter(f.key)} />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-plan" disabled={loading}>
        {loading ? '⏳ Planning your trip…' : '⚡ Plan My Trip →'}
      </button>
    </form>
  )
}

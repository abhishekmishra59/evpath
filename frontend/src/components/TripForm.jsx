import { useState, useEffect } from 'react'
import { geocodeSearch } from '../services/api'
import { VEHICLE_PRESETS } from '../data/vehicles'

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
  vehicleId: 'custom', vehicleName: 'Custom Vehicle',
  currentBatteryPct: 80, vehicleRangeKm: 400,
  batteryCapacityKwh: 60, targetBatteryAtDestPct: 20,
  chargeThresholdPct: 20,
  connectorTypes: ['CCS2', 'Type2'],
  roadPreference: 'recommended',
  filters: { foodCourt: false, restroom: false, parking: false, fastChargerOnly: false, open24x7: false }
}

function buildFormFromInitial(initial) {
  if (!initial) return DEFAULT_FORM
  const preset = VEHICLE_PRESETS.find(v => v.id === initial.vehicleId)
  return {
    ...DEFAULT_FORM,
    ...initial,
    vehicleName: preset?.name || initial.vehicleName || 'Custom Vehicle'
  }
}

export default function TripForm({ onSubmit, loading, initialForm, formKey }) {
  const [form, setForm] = useState(() => buildFormFromInitial(initialForm))
  const [locating, setLocating]   = useState(false)
  const [suggestions, setSuggestions] = useState({ origin: [], dest: [] })
  const [waypointFields, setWaypointFields] = useState(
    () => (initialForm?.waypoints || []).map(a => ({ address: a, suggestions: [] }))
  )
  const [shareCopied, setShareCopied] = useState(false)

  // Re-initialise when parent passes a new initialForm (e.g. history replay or URL share)
  useEffect(() => {
    setForm(buildFormFromInitial(initialForm))
    setWaypointFields((initialForm?.waypoints || []).map(a => ({ address: a, suggestions: [] })))
  }, [formKey])

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

  function handleVehicleChange(vehicleId) {
    const preset = VEHICLE_PRESETS.find(v => v.id === vehicleId)
    if (!preset || preset.id === 'custom') {
      setForm(p => ({ ...p, vehicleId: 'custom', vehicleName: 'Custom Vehicle' }))
      return
    }
    setForm(p => ({
      ...p,
      vehicleId: preset.id,
      vehicleName: preset.name,
      vehicleRangeKm: preset.range,
      batteryCapacityKwh: preset.battery,
      connectorTypes: preset.connectors || p.connectorTypes
    }))
  }

  async function fetchSuggestions(q, field) {
    if (q.length < 3) return setSuggestions(p => ({ ...p, [field]: [] }))
    try {
      const results = await geocodeSearch(q)
      setSuggestions(p => ({ ...p, [field]: results.slice(0, 4) }))
    } catch (_) {}
  }

  // — Waypoints —
  function addWaypoint() {
    if (waypointFields.length >= 3) return
    setWaypointFields(p => [...p, { address: '', suggestions: [] }])
  }
  function removeWaypoint(idx) {
    setWaypointFields(p => p.filter((_, i) => i !== idx))
  }
  async function fetchWpSuggestions(q, idx) {
    if (q.length < 3) {
      setWaypointFields(p => p.map((w, i) => i === idx ? { ...w, suggestions: [] } : w))
      return
    }
    try {
      const results = await geocodeSearch(q)
      setWaypointFields(p => p.map((w, i) => i === idx ? { ...w, suggestions: results.slice(0, 4) } : w))
    } catch (_) {}
  }
  function setWpAddress(idx, address) {
    setWaypointFields(p => p.map((w, i) => i === idx ? { ...w, address } : w))
  }
  function setWpSuggestion(idx, address) {
    setWaypointFields(p => p.map((w, i) => i === idx ? { ...w, address, suggestions: [] } : w))
  }

  // — GPS —
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

  // — Share —
  async function handleShare() {
    if (!form.origin || !form.destination) return
    const shareData = {
      from: form.origin, to: form.destination,
      v:    form.vehicleId,
      batt: form.currentBatteryPct,
      thr:  form.chargeThresholdPct,
      road: form.roadPreference,
      range: form.vehicleRangeKm,
      kwh:  form.batteryCapacityKwh,
      conn:    form.connectorTypes,
      dest:    form.targetBatteryAtDestPct,
      filters: form.filters,
      wp:      waypointFields.map(w => w.address).filter(Boolean)
    }
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shareData))))
    const url = `${window.location.origin}${window.location.pathname}?trip=${encoded}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const inp = document.createElement('input')
      inp.value = url; document.body.appendChild(inp); inp.select()
      document.execCommand('copy'); document.body.removeChild(inp)
    }
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.origin.trim() || !form.destination.trim()) return
    onSubmit({
      ...form,
      roadOptions: buildRoadOptions(),
      waypoints: waypointFields.map(w => w.address).filter(a => a.trim())
    })
  }

  return (
    <form onSubmit={handleSubmit} className="trip-form">
      <div className="form-header">
        <span className="logo">⚡</span>
        <h1>EVPath</h1>
        <p>Plan your EV trip across India</p>
      </div>

      {/* ── Route ── */}
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

      {/* Waypoints */}
      {waypointFields.map((wp, idx) => (
        <div key={idx} className="form-group location-group waypoint-group">
          <label>Via {idx + 1}</label>
          <div className="location-input-row">
            <input
              type="text"
              placeholder={`e.g. Lonavala`}
              value={wp.address}
              onChange={e => { setWpAddress(idx, e.target.value); fetchWpSuggestions(e.target.value, idx) }}
              onBlur={() => setTimeout(() => setWaypointFields(p => p.map((w, i) => i === idx ? { ...w, suggestions: [] } : w)), 200)}
            />
            <button type="button" className="btn-remove-wp" onClick={() => removeWaypoint(idx)} title="Remove stop">✕</button>
          </div>
          {wp.suggestions.length > 0 && (
            <ul className="suggestions">
              {wp.suggestions.map((s, i) => (
                <li key={i} onMouseDown={() => setWpSuggestion(idx, s.displayName)}>{s.displayName}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {waypointFields.length < 3 && (
        <button type="button" className="btn-add-waypoint" onClick={addWaypoint}>
          + Add a stop via
        </button>
      )}

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

      {/* ── Vehicle ── */}
      <div className="form-section-label">Vehicle &amp; Battery</div>

      {/* Vehicle preset selector */}
      <div className="form-group">
        <label>Select Your Vehicle</label>
        <select
          className="vehicle-select"
          value={form.vehicleId}
          onChange={e => handleVehicleChange(e.target.value)}
        >
          {VEHICLE_PRESETS.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        {form.vehicleId !== 'custom' && (
          <div className="vehicle-spec-row">
            <span className="vehicle-spec-badge">{form.vehicleRangeKm} km range</span>
            <span className="vehicle-spec-badge">{form.batteryCapacityKwh} kWh</span>
            <span className="vehicle-spec-hint">Override below if needed</span>
          </div>
        )}
      </div>

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
          <input type="range" min="5" max="40" step="5"
            value={form.chargeThresholdPct}
            onChange={e => set('chargeThresholdPct', +e.target.value)} />
          <span className="range-value">{form.chargeThresholdPct}%</span>
        </div>
        <div className="threshold-hint">
          {form.chargeThresholdPct <= 10 && '⚠ Very low — risky on long stretches without chargers'}
          {form.chargeThresholdPct >= 11 && form.chargeThresholdPct <= 20 && '✓ Comfortable buffer — good for highway trips'}
          {form.chargeThresholdPct >= 25 && form.chargeThresholdPct <= 30 && '⚡ Cautious — more stops but less range anxiety'}
          {form.chargeThresholdPct >= 35 && '🔒 Very conservative — maximum safety, most stops'}
        </div>
      </div>

      {/* Vehicle specs (editable override) */}
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

      {/* ── Charger Preferences ── */}
      <div className="form-section-label">Charger Preferences</div>

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

      {/* ── Actions ── */}
      <button type="submit" className="btn-plan" disabled={loading}>
        {loading ? '⏳ Planning your trip…' : '⚡ Plan My Trip →'}
      </button>

      <button
        type="button"
        className={`btn-share ${shareCopied ? 'btn-share-copied' : ''}`}
        onClick={handleShare}
        disabled={!form.origin || !form.destination}
      >
        {shareCopied ? '✓ Link copied!' : '🔗 Share this trip'}
      </button>
    </form>
  )
}

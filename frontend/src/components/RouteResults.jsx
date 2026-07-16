import { useState, useEffect, useRef } from 'react'
import RouteCard from './RouteCard'
import MapView from './MapView'
import StationPicker from './StationPicker'

function fmt(min) { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h}h ${m}m` : `${m}m` }

function ShareButton({ formData, selectedRoute, selectedStations }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (!formData) return
    const shareData = {
      from:    formData.origin,
      to:      formData.destination,
      v:       formData.vehicleId    || 'custom',
      batt:    formData.currentBatteryPct,
      thr:     formData.chargeThresholdPct,
      road:    formData.roadPreference,
      range:   formData.vehicleRangeKm,
      kwh:     formData.batteryCapacityKwh,
      conn:    formData.connectorTypes,
      dest:    formData.targetBatteryAtDestPct,
      filters: formData.filters,
      wp:      (formData.waypoints || []).filter(Boolean),
      // Encode selected route + stations only when sharing from detail page
      ...(selectedRoute && {
        variant: selectedRoute.variant,
        stops:   selectedRoute.chargingStops.map((_, i) => selectedStations?.[i] ?? 0)
      })
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
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button className={`btn-share-inline ${copied ? 'btn-share-copied' : ''}`} onClick={handleShare}>
      {copied ? '✓ Copied!' : '🔗 Share'}
    </button>
  )
}

export default function RouteResults({ routes, tripMeta, batteryCapacityKwh = 60, formData, initialSelection, onBack, onRefine, onStartNav }) {
  const [selectedRoute, setSelectedRoute]       = useState(null)
  const [selectedStations, setSelectedStations] = useState({})
  const selectionApplied = useRef(false)

  // Auto-select route + stations when a shared selection is decoded
  useEffect(() => {
    if (!initialSelection || !routes || selectionApplied.current) return
    const route = routes.find(r => r.variant === initialSelection.variant)
    if (!route) return
    selectionApplied.current = true
    setSelectedRoute(route)
    const stopsArray = initialSelection.stops || []
    const stationsMap = route.chargingStops.reduce((acc, _, i) => {
      acc[i] = stopsArray[i] ?? 0
      return acc
    }, {})
    setSelectedStations(stationsMap)
  }, [initialSelection, routes])

  function selectRoute(route) {
    setSelectedRoute(route)
    const defaults = {}
    route.chargingStops.forEach((_, i) => { defaults[i] = 0 })
    setSelectedStations(defaults)
  }

  function handleStationSelect(stopIdx, stationIdx) {
    setSelectedStations(p => ({ ...p, [stopIdx]: stationIdx }))
  }

  if (selectedRoute) {
    const stopCount = selectedRoute.chargingStops.length
    return (
      <div className="detail-page">
        <div className="detail-header">
          <button className="btn-back" onClick={() => setSelectedRoute(null)}>← Back to routes</button>
          <div className="detail-title">
            <span className="route-label-badge">{selectedRoute.label}</span>
            <span className="trip-cities">{tripMeta.origin} → {tripMeta.destination}</span>
          </div>
          <div className="detail-header-actions">
            <button className="btn-refine" onClick={onRefine}>✏ Refine</button>
            <ShareButton formData={formData} selectedRoute={selectedRoute} selectedStations={selectedStations} />
          </div>
        </div>

        <div className="detail-body">
          {/* Left: map + summary + navigate */}
          <div className="detail-left">
            <div className="map-wrapper">
              <MapView
                route={selectedRoute}
                selectedStops={selectedStations}
                onStationClick={handleStationSelect}
              />
            </div>

            <div className="trip-summary-box">
              <div className="summary-stat">
                <span className="stat-label">Distance</span>
                <span className="stat-value">{selectedRoute.totalDistanceKm} km</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Drive Time</span>
                <span className="stat-value">{fmt(selectedRoute.driveTimeMin)}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Charging</span>
                <span className="stat-value">{fmt(selectedRoute.totalChargeTimeMin)}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Total Time</span>
                <span className="stat-value">{fmt(selectedRoute.totalTimeMin)}</span>
              </div>
            </div>

            <button className="btn-navigate" onClick={() => onStartNav(selectedRoute, selectedStations)}>
              ▶ Start Navigation
            </button>

            <p className="data-disclaimer" style={{ marginTop: '1rem' }}>⚠ Charging station data from OpenChargeMap (community-maintained). Verify availability before travel.</p>
          </div>

          {/* Right: charging stops */}
          <div className="detail-right">
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              Charging Stops ({stopCount})
            </div>
            <div className="stops-list">
              {stopCount === 0 ? (
                <div className="no-stops-banner">✅ No charging stops needed — your battery is sufficient for this trip!</div>
              ) : (
                selectedRoute.chargingStops.map((stop, i) => (
                  <StationPicker
                    key={i}
                    stop={stop}
                    selectedIndex={selectedStations[i] ?? 0}
                    onSelect={idx => handleStationSelect(i, idx)}
                    batteryCapacityKwh={batteryCapacityKwh}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="results-page">
      <div className="results-header">
        <div className="results-back-row">
          <button className="btn-back" onClick={onBack}>← New Trip</button>
          <button className="btn-refine" onClick={onRefine}>✏ Refine Search</button>
          <ShareButton formData={formData} />
        </div>
        <div className="results-trip-title">
          <span>{tripMeta.origin}</span>
          <span className="trip-arrow">→</span>
          <span>{tripMeta.destination}</span>
        </div>
        <p className="results-subtitle">Choose a route to view details and select your charging stations</p>
      </div>

      <div className="route-cards">
        {routes.map(route => (
          <RouteCard key={route.id} route={route} onSelect={() => selectRoute(route)} />
        ))}
      </div>

      <p className="data-disclaimer">⚠ Charging station data from OpenChargeMap (community-maintained).</p>
    </div>
  )
}

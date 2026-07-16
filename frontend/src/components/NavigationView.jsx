import { useState, useEffect, useRef } from 'react'
import MapView from './MapView'

function distKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const sin2 = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2))
}

function fmtDist(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}
function fmtTime(min) {
  const h = Math.floor(min / 60); const m = Math.round(min % 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

export default function NavigationView({ route, selectedStops, onExit }) {
  const [position, setPosition]         = useState(null)
  const [speed, setSpeed]               = useState(0)
  const [stepIdx, setStepIdx]           = useState(0)
  const [distTravelled, setDistTravelled] = useState(0)
  const [etaMin, setEtaMin]             = useState(null)
  const [autoFollow, setAutoFollow]     = useState(true)

  const watchIdRef     = useRef(null)
  const lastPosRef     = useRef(null)
  const speedHistRef   = useRef([])   // rolling buffer of last 5 non-zero GPS speeds
  const lastEtaRef     = useRef(null) // for smoothing

  const steps   = route.steps || []
  const coords  = (route.geometryCoords || []).map(([lng, lat]) => ({ lat, lng }))
  const totalDist = route.totalDistanceKm

  // Planned average speed from route data — much more accurate than 30 km/h hardcoded
  const plannedAvgKmh = route.driveTimeMin > 0
    ? totalDist / (route.driveTimeMin / 60)
    : 60

  const currentStep   = steps[stepIdx] || null
  const distRemaining = Math.max(0, totalDist - distTravelled)

  function calcEta(remaining, currentSpeedKmh) {
    // Build effective speed: prefer rolling avg GPS; fall back to planned avg
    const hist = speedHistRef.current
    const avgGpsSpeed = hist.length > 0
      ? hist.reduce((a, b) => a + b, 0) / hist.length
      : 0

    // Use GPS average if we have enough readings, else blend with planned speed
    let effectiveSpeed
    if (hist.length >= 3) {
      effectiveSpeed = avgGpsSpeed
    } else if (hist.length > 0) {
      // Blend GPS reading with planned speed while we gather more data
      const weight = hist.length / 3
      effectiveSpeed = weight * avgGpsSpeed + (1 - weight) * plannedAvgKmh
    } else {
      // No GPS speed yet — use planned route average
      effectiveSpeed = plannedAvgKmh
    }

    // Never go below 15 km/h (stopped at charger etc)
    effectiveSpeed = Math.max(effectiveSpeed, 15)

    const rawEta = Math.round((remaining / effectiveSpeed) * 60) + route.totalChargeTimeMin

    // Smooth: don't let ETA jump by more than 15 min per GPS update
    if (lastEtaRef.current !== null) {
      const maxDelta = 15
      const clamped = Math.min(
        Math.max(rawEta, lastEtaRef.current - maxDelta),
        lastEtaRef.current + maxDelta
      )
      lastEtaRef.current = clamped
      return clamped
    }

    lastEtaRef.current = rawEta
    return rawEta
  }

  useEffect(() => {
    // Set initial ETA from planned route before GPS kicks in
    setEtaMin(route.driveTimeMin + route.totalChargeTimeMin)
    lastEtaRef.current = route.driveTimeMin + route.totalChargeTimeMin

    if (!navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, speed: spd } = pos.coords
        const newPos = { lat, lng }
        setPosition(newPos)

        // Accumulate speed into rolling buffer (only non-zero readings)
        const kmh = spd ? Math.round(spd * 3.6) : 0
        setSpeed(kmh)
        if (kmh > 5) {
          speedHistRef.current = [...speedHistRef.current.slice(-4), kmh]
        }

        // Accumulate distance
        let addedDist = 0
        if (lastPosRef.current) {
          addedDist = distKm(lastPosRef.current, newPos)
          // Sanity check: GPS can jump — ignore > 1km per update (about 5s interval)
          if (addedDist < 1) {
            setDistTravelled(prev => {
              const newDist = prev + addedDist
              setEtaMin(calcEta(Math.max(0, totalDist - newDist), kmh))
              return newDist
            })
          }
        } else {
          // First fix — just recalculate ETA without changing distTravelled
          setEtaMin(calcEta(totalDist, kmh))
        }
        lastPosRef.current = newPos

        // Advance nav step
        if (steps[stepIdx]) {
          const stepCoordIdx = steps[stepIdx].wayPoints?.[0] ?? 0
          const stepCoord = coords[stepCoordIdx]
          if (stepCoord && distKm(newPos, stepCoord) < 0.05 && stepIdx < steps.length - 1) {
            setStepIdx(i => i + 1)
          }
        }
      },
      err => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )

    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [])

  // Next charging stop
  const nextStop = route.chargingStops?.find(s => s.kmFromStart > distTravelled)
  const displayEta = etaMin ?? (route.driveTimeMin + route.totalChargeTimeMin)

  return (
    <div className="nav-overlay">
      {/* Top instruction banner */}
      <div className="nav-top">
        <div className="nav-instruction">
          <span className="nav-icon">{currentStep?.icon || '↑'}</span>
          <div className="nav-text">
            <div className="nav-main">{currentStep?.instruction || 'Follow the route'}</div>
            {currentStep?.name && <div className="nav-road">{currentStep.name}</div>}
          </div>
          {currentStep?.distance != null && (
            <div className="nav-dist">{fmtDist(currentStep.distance)}</div>
          )}
        </div>

        {nextStop && (
          <div className="nav-stop-ahead">
            ⚡ Charging stop in {fmtDist(Math.max(0, nextStop.kmFromStart - distTravelled))} — {nextStop.station?.name}
          </div>
        )}
      </div>

      {/* Full screen map */}
      <div className="nav-map">
        <MapView
          route={route}
          selectedStops={selectedStops}
          navPosition={position}
          followUser={autoFollow}
          onMapDrag={() => setAutoFollow(false)}
          navMode={true}
        />
        <button
          className={`nav-gps-btn ${autoFollow ? 'nav-gps-active' : ''}`}
          onClick={() => setAutoFollow(true)}
          title={autoFollow ? 'Following your location' : 'Centre on my location'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="7"/>
            <line x1="12" y1="1" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="1" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="23" y2="12"/>
          </svg>
          {!position && <span className="nav-gps-wait">…</span>}
        </button>
      </div>

      {/* Bottom status bar */}
      <div className="nav-bottom">
        <div className="nav-stat">
          <div className="nav-stat-val">{speed || '—'}</div>
          <div className="nav-stat-label">km/h</div>
        </div>
        <div className="nav-stat nav-stat-main">
          <div className="nav-stat-val">{fmtDist(distRemaining)}</div>
          <div className="nav-stat-label">remaining</div>
        </div>
        <div className="nav-stat">
          <div className="nav-stat-val">{fmtTime(displayEta)}</div>
          <div className="nav-stat-label">ETA</div>
        </div>
        <div className="nav-stat">
          <div className="nav-stat-val">{route.chargingStops?.length || 0}</div>
          <div className="nav-stat-label">stops</div>
        </div>
        <button className="nav-exit" onClick={onExit}>✕ Exit</button>
      </div>

      <StepsPanel steps={steps} currentIdx={stepIdx} />
    </div>
  )
}

function StepsPanel({ steps, currentIdx }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`steps-panel ${open ? 'steps-open' : ''}`}>
      <button className="steps-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▼ Hide directions' : '▲ All directions'}
      </button>
      {open && (
        <div className="steps-list">
          {steps.map((s, i) => (
            <div key={i} className={`step-row ${i === currentIdx ? 'step-current' : ''} ${i < currentIdx ? 'step-done' : ''}`}>
              <span className="step-icon">{s.icon}</span>
              <span className="step-instr">{s.instruction}</span>
              <span className="step-dist">{fmtDist(s.distance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

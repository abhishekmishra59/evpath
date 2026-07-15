const ICONS   = { fastest: '⚡', fewestStops: '🛑', bestAmenities: '🍽' }
const VARIANT_LABELS = { fastest: 'Fastest', fewestStops: 'Fewest Stops', bestAmenities: 'Best Amenities' }

function fmt(min) { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h}h ${m}m` : `${m}m` }

export default function RouteCard({ route, onSelect }) {
  const stopsCount   = route.chargingStops?.length ?? 0
  const optionsCount = route.chargingStops?.reduce((sum, s) => sum + (s.stationOptions?.length || 1), 0) ?? 0

  return (
    <div className="route-card">
      <div className="route-card-header">
        <div className="route-icon-circle">{ICONS[route.variant]}</div>
        <div>
          <div className="route-label">{route.label}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 600, marginTop: '0.1rem' }}>
            {stopsCount === 0 ? 'No charging stops needed' : `${stopsCount} charging stop${stopsCount > 1 ? 's' : ''}`}
          </div>
        </div>
        <span className="route-variant-tag">{VARIANT_LABELS[route.variant]}</span>
      </div>

      <div className="route-stats">
        <div className="route-stat">
          <span className="stat-num">{fmt(route.totalTimeMin)}</span>
          <span className="stat-desc">Total Time</span>
        </div>
        <div className="route-stat">
          <span className="stat-num">{route.totalDistanceKm} km</span>
          <span className="stat-desc">Distance</span>
        </div>
        <div className="route-stat">
          <span className="stat-num">{fmt(route.totalChargeTimeMin)}</span>
          <span className="stat-desc">Charge Time</span>
        </div>
      </div>

      <div className="charger-info">
        {route.maxChargerKw >= 50
          ? <span className="badge badge-fast">⚡ {route.maxChargerKw}kW DC Fast</span>
          : route.maxChargerKw > 0
            ? <span className="badge badge-slow">🔌 {route.maxChargerKw}kW AC</span>
            : null
        }
        {optionsCount > stopsCount && (
          <span className="badge badge-info">{optionsCount} station options</span>
        )}
        {stopsCount === 0 && (
          <span className="badge badge-fast">✅ Direct trip</span>
        )}
      </div>

      <div className="pros-cons">
        <ul className="pros-list">
          {route.pros?.slice(0, 2).map((p, i) => (
            <li key={i} className="pro-item"><span>✅</span><span>{p}</span></li>
          ))}
        </ul>
        <ul className="cons-list">
          {route.cons?.slice(0, 2).map((c, i) => (
            <li key={i} className="con-item"><span>⚠️</span><span>{c}</span></li>
          ))}
        </ul>
      </div>

      <button className="btn-select" onClick={onSelect}>
        View Route &amp; Choose Stations →
      </button>
    </div>
  )
}

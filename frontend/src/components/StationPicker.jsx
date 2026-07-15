import { useState } from 'react'
import { getStationStatus } from '../services/api'

const STATUS_STYLE = { Available: 'status-available', Busy: 'status-busy', Offline: 'status-offline', Unknown: 'status-unknown' }
const RATE_PER_KWH = 18  // ₹18/kWh default estimate

function fmt(min) {
  if (!min || min <= 0) return '—'
  const h = Math.floor(min / 60); const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function calcChargeTime(station, stop, batteryCapacityKwh) {
  const kw = station.maxPowerKw || 7.4  // default 7.4kW AC if charger power unknown
  const kwhNeeded = ((stop.chargeTo - stop.arrivalBatteryPct) / 100) * batteryCapacityKwh
  const taper = stop.chargeTo > 80 ? 1.4 : 1.0
  return Math.round((kwhNeeded / (kw * 0.9)) * 60 * taper)
}

function calcKwh(stop, batteryCapacityKwh) {
  return Math.round(((stop.chargeTo - stop.arrivalBatteryPct) / 100) * batteryCapacityKwh * 10) / 10
}

export default function StationPicker({ stop, selectedIndex, onSelect, batteryCapacityKwh = 60 }) {
  const [refreshing, setRefreshing] = useState(null)
  const [statuses, setStatuses]     = useState({})

  const options  = stop.stationOptions?.length ? stop.stationOptions : [stop.station]
  const selected = options[selectedIndex] || options[0]

  // Recalculate for the currently selected station
  const selChargeTime = selected ? calcChargeTime(selected, stop, batteryCapacityKwh) : 0
  const kwhNeeded     = calcKwh(stop, batteryCapacityKwh)
  const costEstimate  = Math.round(kwhNeeded * RATE_PER_KWH)

  async function refreshStatus(stationId, i) {
    setRefreshing(i)
    try {
      const data = await getStationStatus(stationId)
      setStatuses(p => ({ ...p, [stationId]: data.status }))
    } catch (_) {}
    setRefreshing(null)
  }

  return (
    <div className="station-picker">

      {/* Stop header */}
      <div className="stop-header">
        <div className="stop-badge">Stop {stop.stopNumber}</div>
        <div className="stop-meta">
          <span>Arrive at <strong className="batt-low">{stop.arrivalBatteryPct}%</strong></span>
          <span className="sep">→</span>
          <span>Charge to <strong className="batt-high">{stop.chargeTo}%</strong></span>
          <span className="sep">·</span>
          <span>{stop.kmFromStart} km from start</span>
        </div>
      </div>

      {/* Station option cards — horizontal scroll */}
      <p className="picker-label">
        {options.length} station{options.length > 1 ? 's' : ''} near this stop — pick one:
      </p>

      <div className="station-options-scroll">
        {options.map((station, i) => {
          const liveStatus = statuses[station.id] || station.status
          const chargeTime = calcChargeTime(station, stop, batteryCapacityKwh)
          const isSelected = i === selectedIndex
          const hasUnknownPower = !station.maxPowerKw

          return (
            <div
              key={station.id + i}
              className={`station-option-card ${isSelected ? 'option-selected' : ''}`}
              onClick={() => onSelect(i)}
            >
              {isSelected && <div className="selected-tick">✓ Selected</div>}

              <div className="opt-name">{station.name}</div>
              <div className="opt-addr">{station.address?.split(',').slice(0, 2).join(',') || '—'}</div>

              {/* Live status */}
              <div className={`opt-status ${STATUS_STYLE[liveStatus] || 'status-unknown'}`}>
                ● {liveStatus}
                {station.id !== 'unknown' && (
                  <button
                    className="refresh-btn"
                    onClick={e => { e.stopPropagation(); refreshStatus(station.id, i) }}
                    disabled={refreshing === i}
                    title="Refresh live status"
                  >
                    {refreshing === i ? '…' : '↻'}
                  </button>
                )}
              </div>

              {/* Charger power */}
              <div className="opt-power">
                {station.maxPowerKw >= 50
                  ? <span className="badge badge-fast">⚡ {station.maxPowerKw}kW DC Fast</span>
                  : station.maxPowerKw > 0
                    ? <span className="badge badge-slow">🔌 {station.maxPowerKw}kW AC</span>
                    : <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>🔌 Power unknown</span>
                }
              </div>

              {/* Charge time — always show, use default kW if unknown */}
              <div className="opt-time">
                ~{fmt(chargeTime)} charge
                {hasUnknownPower && <span className="est-note"> (est.)</span>}
              </div>

              {/* Connectors */}
              {station.connections?.length > 0 && (
                <div className="opt-connectors">
                  {station.connections.slice(0, 2).map((c, ci) => (
                    <span key={ci} className="conn-tag">
                      {c.connectorName?.replace(' (Mennekes)', '')}
                    </span>
                  ))}
                </div>
              )}

              {/* Cost — show platform rate if station doesn't have one */}
              <div className="opt-cost">
                {station.usageCost
                  ? station.usageCost
                  : <span style={{ color: '#a0aec0' }}>~₹{Math.round(calcKwh(stop, batteryCapacityKwh) * RATE_PER_KWH)} est.</span>
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected station detail — recalculated for current selection */}
      {selected && selected.id !== 'unknown' && (
        <div className="selected-detail">
          <div className="detail-row">
            <span>Est. charge time</span>
            <span>
              {fmt(selChargeTime)}
              {!selected.maxPowerKw && <span className="est-note"> (based on 7.4kW AC)</span>}
            </span>
          </div>
          <div className="detail-row">
            <span>Energy needed</span>
            <span>{kwhNeeded} kWh</span>
          </div>
          <div className="detail-row highlight">
            <span>Est. cost</span>
            <span>
              ₹{costEstimate}
              {!selected.usageCost && <span className="est-note"> (@₹{RATE_PER_KWH}/kWh est.)</span>}
            </span>
          </div>
          {selected.totalPoints > 0 && (
            <div className="detail-row">
              <span>Charging points</span>
              <span>{selected.totalPoints}</span>
            </div>
          )}
          {selected.operatorName && (
            <div className="detail-row">
              <span>Operator</span>
              <span>{selected.operatorName}</span>
            </div>
          )}
          {selected.lastStatusUpdate && (
            <div className="last-updated">
              Status last updated: {new Date(selected.lastStatusUpdate).toLocaleString('en-IN')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

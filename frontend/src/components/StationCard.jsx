import { useState, useEffect } from 'react'
import { getStationStatus } from '../services/api'

const STATUS_STYLE = {
  Available: 'status-available',
  Busy:      'status-busy',
  Offline:   'status-offline',
  Unknown:   'status-unknown'
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function StationCard({ stop }) {
  const { station, arrivalBatteryPct, chargeTo, estimatedChargeTimeMin, kwhCharged, costEstimateINR, stopNumber } = stop
  const [liveStatus, setLiveStatus] = useState(station.status)
  const [refreshing, setRefreshing] = useState(false)

  async function refreshStatus() {
    setRefreshing(true)
    try {
      const data = await getStationStatus(station.id)
      setLiveStatus(data.status)
    } catch (_) {}
    setRefreshing(false)
  }

  useEffect(() => {
    const interval = setInterval(refreshStatus, 120000)
    return () => clearInterval(interval)
  }, [station.id])

  return (
    <div className="station-card">
      <div className="station-header">
        <div className="stop-number">Stop {stopNumber}</div>
        <div className="station-name">{station.name}</div>
        <div className={`status-badge ${STATUS_STYLE[liveStatus] || 'status-unknown'}`}>
          {liveStatus}
          <button className="refresh-btn" onClick={refreshStatus} disabled={refreshing} title="Refresh status">
            {refreshing ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div className="station-address">{station.address}</div>

      {station.operatorName && (
        <div className="station-operator">Operated by {station.operatorName}</div>
      )}

      <div className="station-details">
        <div className="detail-row">
          <span>Charger</span>
          <span>{station.maxPowerKw ? `${station.maxPowerKw}kW` : 'Unknown'}{station.isFastCharger ? ' DC Fast' : ' AC'}</span>
        </div>
        <div className="detail-row">
          <span>Connectors</span>
          <span>{station.connections?.map(c => c.connectorName).join(', ') || '—'}</span>
        </div>
        <div className="detail-row">
          <span>Points</span>
          <span>{station.totalPoints} total</span>
        </div>
        <div className="detail-row">
          <span>Arrive at</span>
          <span className="battery-val">{arrivalBatteryPct}% 🔋</span>
        </div>
        <div className="detail-row">
          <span>Charge to</span>
          <span className="battery-val">{chargeTo}% 🔋</span>
        </div>
        <div className="detail-row">
          <span>Est. charge time</span>
          <span>{formatTime(estimatedChargeTimeMin)}</span>
        </div>
        <div className="detail-row">
          <span>Energy needed</span>
          <span>{kwhCharged} kWh</span>
        </div>
        {station.usageCost && (
          <div className="detail-row">
            <span>Rate</span>
            <span>{station.usageCost}</span>
          </div>
        )}
        <div className="detail-row highlight">
          <span>Est. cost</span>
          <span>₹{costEstimateINR}</span>
        </div>
      </div>

      {station.amenities && (
        <div className="amenities-row">
          {station.amenities.foodCourt && <span className="amenity-tag">🍽 Food</span>}
          {station.amenities.restroom  && <span className="amenity-tag">🚻 Restroom</span>}
          {station.amenities.parking   && <span className="amenity-tag">🅿 Parking</span>}
          {station.is24Hours           && <span className="amenity-tag">🕐 24x7</span>}
        </div>
      )}

      {station.lastStatusUpdate && (
        <div className="last-updated">
          Status last updated: {new Date(station.lastStatusUpdate).toLocaleString('en-IN')}
        </div>
      )}
    </div>
  )
}

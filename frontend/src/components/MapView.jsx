import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeIcon(html, size = 36) {
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

const startIcon    = makeIcon('<div class="map-marker marker-start">A</div>')
const endIcon      = makeIcon('<div class="map-marker marker-end">B</div>')
const chargerIcon  = makeIcon('<div class="map-marker marker-charger">⚡</div>')
const altIcon      = makeIcon('<div class="map-marker marker-alt">⚡</div>', 28)
const userIcon     = makeIcon('<div class="map-marker marker-user"></div>', 20)

export default function MapView({
  route,
  selectedStops,       // array: which station is selected per stop
  onStationClick,      // (stopIdx, stationIdx) => void
  navPosition,         // { lat, lng } — live GPS position (navigation mode)
  navMode              // bool
}) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const layersRef    = useRef({ route: null, markers: [], user: null })

  // Init map once
  useEffect(() => {
    if (mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Draw route + station markers whenever route changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !route) return

    // Clear old layers
    const { route: rLayer, markers } = layersRef.current
    if (rLayer) rLayer.remove()
    markers.forEach(m => m.remove())
    layersRef.current = { route: null, markers: [], user: layersRef.current.user }

    const positions = (route.geometryCoords || []).map(([lng, lat]) => [lat, lng])
    const newMarkers = []

    if (positions.length > 1) {
      const polyline = L.polyline(positions, { color: '#00E094', weight: 5, opacity: 0.9 }).addTo(map)
      layersRef.current.route = polyline

      // Start / End markers
      const startM = L.marker(positions[0], { icon: startIcon })
        .bindPopup('<strong>Start</strong>').addTo(map)
      const endM = L.marker(positions[positions.length - 1], { icon: endIcon })
        .bindPopup('<strong>Destination</strong>').addTo(map)
      newMarkers.push(startM, endM)

      // Fit map
      map.fitBounds(polyline.getBounds(), { padding: [48, 48] })
    }

    // Charging stop markers
    ;(route.chargingStops || []).forEach((stop, stopIdx) => {
      const selIdx = selectedStops?.[stopIdx] ?? 0

      // Show all station options as markers
      ;(stop.stationOptions || [stop.station]).forEach((station, sIdx) => {
        if (!station?.lat || !station?.lng) return
        const isSelected = sIdx === selIdx
        const icon = isSelected ? chargerIcon : altIcon
        const m = L.marker([station.lat, station.lng], { icon })
          .bindPopup(`
            <div style="min-width:180px">
              <strong>${station.name}</strong><br/>
              ${station.address}<br/>
              <span style="color:${station.status === 'Available' ? 'green' : station.status === 'Busy' ? 'orange' : 'gray'}">
                ● ${station.status}
              </span><br/>
              ${station.maxPowerKw ? `${station.maxPowerKw}kW` : ''}
              ${isSelected ? '<br/><em style="color:#3b82f6">✓ Selected for stop ' + (stopIdx + 1) + '</em>' : ''}
            </div>
          `)
          .addTo(map)
        m.on('click', () => onStationClick?.(stopIdx, sIdx))
        newMarkers.push(m)
      })
    })

    layersRef.current.markers = newMarkers
  }, [route, selectedStops])

  // Live GPS position marker
  const updateUserMarker = useCallback((pos) => {
    const map = mapRef.current
    if (!map || !pos) return
    if (layersRef.current.user) {
      layersRef.current.user.setLatLng([pos.lat, pos.lng])
    } else {
      layersRef.current.user = L.marker([pos.lat, pos.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
    }
    if (navMode) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 })
  }, [navMode])

  useEffect(() => {
    updateUserMarker(navPosition)
  }, [navPosition, updateUserMarker])

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', borderRadius: navMode ? 0 : '12px' }}
    />
  )
}

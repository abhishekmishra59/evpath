import { useEffect, useRef } from 'react'
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

const startIcon   = makeIcon('<div class="map-marker marker-start">A</div>')
const endIcon     = makeIcon('<div class="map-marker marker-end">B</div>')
const chargerIcon = makeIcon('<div class="map-marker marker-charger">⚡</div>')
const altIcon     = makeIcon('<div class="map-marker marker-alt">⚡</div>', 28)
const userIcon    = makeIcon('<div class="map-marker marker-user"><div class="marker-user-dot"></div></div>', 32)

export default function MapView({
  route,
  selectedStops,
  onStationClick,
  navPosition,   // { lat, lng } — live GPS position
  followUser,    // bool — whether to auto-pan to user position
  onMapDrag,     // () => void — called when user manually pans
  navMode
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

    // Tell parent when user manually drags (so it can disable auto-follow)
    map.on('dragstart', () => onMapDrag?.())

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Draw route + station markers whenever route changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !route) return

    const { route: rLayer, markers } = layersRef.current
    if (rLayer) rLayer.remove()
    markers.forEach(m => m.remove())
    layersRef.current = { route: null, markers: [], user: layersRef.current.user }

    const positions = (route.geometryCoords || []).map(([lng, lat]) => [lat, lng])
    const newMarkers = []

    if (positions.length > 1) {
      const polyline = L.polyline(positions, { color: '#00E094', weight: 5, opacity: 0.9 }).addTo(map)
      layersRef.current.route = polyline

      const startM = L.marker(positions[0], { icon: startIcon })
        .bindPopup('<strong>Start</strong>').addTo(map)
      const endM = L.marker(positions[positions.length - 1], { icon: endIcon })
        .bindPopup('<strong>Destination</strong>').addTo(map)
      newMarkers.push(startM, endM)

      map.fitBounds(polyline.getBounds(), { padding: [48, 48] })
    }

    ;(route.chargingStops || []).forEach((stop, stopIdx) => {
      const selIdx = selectedStops?.[stopIdx] ?? 0
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
              ${isSelected ? '<br/><em style="color:#00E094">✓ Selected for stop ' + (stopIdx + 1) + '</em>' : ''}
            </div>
          `)
          .addTo(map)
        m.on('click', () => onStationClick?.(stopIdx, sIdx))
        newMarkers.push(m)
      })
    })

    layersRef.current.markers = newMarkers
  }, [route, selectedStops])

  // Always keep the user marker at the latest GPS position
  useEffect(() => {
    const map = mapRef.current
    if (!map || !navPosition) return
    if (layersRef.current.user) {
      layersRef.current.user.setLatLng([navPosition.lat, navPosition.lng])
    } else {
      layersRef.current.user = L.marker(
        [navPosition.lat, navPosition.lng],
        { icon: userIcon, zIndexOffset: 1000 }
      ).addTo(map)
    }
  }, [navPosition])

  // Pan to user only when followUser is true — fires immediately on button click too
  useEffect(() => {
    const map = mapRef.current
    if (!map || !navPosition || !followUser) return
    map.panTo([navPosition.lat, navPosition.lng], { animate: true, duration: 0.5 })
  }, [navPosition, followUser])

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', borderRadius: navMode ? 0 : '12px' }}
    />
  )
}

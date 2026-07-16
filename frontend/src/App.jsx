import { useState, useEffect, useRef } from 'react'
import TripForm from './components/TripForm'
import RouteResults from './components/RouteResults'
import NavigationView from './components/NavigationView'
import { planTrip } from './services/api'
import { VEHICLE_PRESETS } from './data/vehicles'

function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === 'light'
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label="Toggle dark/light mode">
      <span className="toggle-label">{isLight ? '☀' : '🌙'}</span>
      <div className={`toggle-track${isLight ? ' is-light' : ''}`}>
        <div className={`toggle-thumb${isLight ? ' is-light' : ''}`} />
      </div>
    </button>
  )
}

function Navbar({ onLogoClick, theme, onToggleTheme }) {
  return (
    <nav className="navbar">
      <div className="nav-inner">
        <button className="nav-logo" onClick={onLogoClick}>
          <span className="logo-bolt">⚡</span>
          <span className="logo-name">EVPath</span>
          <span className="logo-tag">India</span>
        </button>
        <div className="nav-right">
          <span className="nav-pill">Free · Real Data · GPS Nav</span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </nav>
  )
}

function relativeDate(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('evpath-history') || '[]') } catch { return [] }
}

function parseSharedTrip() {
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('trip')
    if (!encoded) return null
    const data = JSON.parse(decodeURIComponent(escape(atob(encoded))))
    const preset = VEHICLE_PRESETS.find(v => v.id === data.v)
    return {
      form: {
        origin:                 data.from || '',
        destination:            data.to   || '',
        vehicleId:              data.v    || 'custom',
        vehicleName:            preset?.name || 'Custom Vehicle',
        currentBatteryPct:      data.batt  ?? 80,
        chargeThresholdPct:     data.thr   ?? 20,
        targetBatteryAtDestPct: data.dest  ?? 20,
        roadPreference:         data.road  || 'recommended',
        vehicleRangeKm:         data.range || preset?.range   || 300,
        batteryCapacityKwh:     data.kwh   || preset?.battery || 40,
        connectorTypes:         data.conn    || preset?.connectors || ['CCS2', 'Type2'],
        filters:                data.filters || { foodCourt: false, restroom: false, parking: false, fastChargerOnly: false, open24x7: false },
        waypoints:              data.wp      || []
      },
      // Route + station selection (only present when shared from detail page)
      selection: data.variant ? { variant: data.variant, stops: data.stops || [] } : null
    }
  } catch { return null }
}

export default function App() {
  const [routes, setRoutes]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [tripMeta, setTripMeta]     = useState(null)
  const [navRoute, setNavRoute]     = useState(null)
  const [navStops, setNavStops]     = useState(null)
  const [batteryKwh, setBatteryKwh] = useState(60)
  const [lastFormData, setLastFormData] = useState(null)
  const [theme, setTheme]           = useState(() => localStorage.getItem('evpath-theme') || 'dark')
  const [history, setHistory]         = useState(loadHistory)
  const [initialForm, setInitialForm] = useState(null)
  const [sharedSelection, setSharedSelection] = useState(null)
  const [formKey, setFormKey]         = useState(0)
  const [isOffline, setIsOffline]     = useState(!navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState(null)
  const deferredPrompt = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('evpath-theme', theme)
  }, [theme])

  // Offline / online detection
  useEffect(() => {
    const goOnline  = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  // PWA install prompt
  useEffect(() => {
    const handler = e => { e.preventDefault(); deferredPrompt.current = e; setInstallPrompt(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    if (outcome === 'accepted') { deferredPrompt.current = null; setInstallPrompt(false) }
  }

  // On mount: if a ?trip= share link was opened, auto-plan immediately
  useEffect(() => {
    const parsed = parseSharedTrip()
    if (!parsed) return
    window.history.replaceState({}, '', window.location.pathname)
    setInitialForm(parsed.form)
    setFormKey(k => k + 1)
    if (parsed.selection) setSharedSelection(parsed.selection)
    handlePlanTrip(parsed.form)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  function handleReplay(historyEntry) {
    setInitialForm(historyEntry.form)
    setFormKey(k => k + 1)
    setRoutes(null); setError(null)
  }

  function clearHistory() {
    setHistory([])
    localStorage.removeItem('evpath-history')
  }

  async function handlePlanTrip(formData) {
    if (!navigator.onLine) {
      setError('You are offline. Connect to the internet to plan a new trip. Your recent trips are still available below.')
      return
    }
    setLoading(true); setError(null); setRoutes(null)
    setBatteryKwh(formData.batteryCapacityKwh || 60)
    setLastFormData(formData)
    setTripMeta({ origin: formData.origin, destination: formData.destination })
    try {
      const result = await planTrip(formData)
      setRoutes(result)

      // Save to localStorage history (deduplicate by origin+destination)
      const entry = {
        id:          Date.now(),
        origin:      formData.origin,
        destination: formData.destination,
        vehicleName: formData.vehicleName || 'Custom Vehicle',
        date:        new Date().toISOString(),
        form:        formData
      }
      const newHistory = [
        entry,
        ...history.filter(h => !(h.origin === entry.origin && h.destination === entry.destination))
      ].slice(0, 5)
      setHistory(newHistory)
      localStorage.setItem('evpath-history', JSON.stringify(newHistory))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to plan trip.')
    } finally {
      setLoading(false)
    }
  }

  function handleStartNav(route, selectedStops) { setNavRoute(route); setNavStops(selectedStops) }
  function handleExitNav() { setNavRoute(null); setNavStops(null) }
  function handleReset() { setRoutes(null); setError(null) }
  function handleRefine() {
    setInitialForm(lastFormData)
    setFormKey(k => k + 1)
    setRoutes(null)
    setError(null)
  }

  if (navRoute) {
    return <NavigationView route={navRoute} selectedStops={navStops} onExit={handleExitNav} />
  }

  return (
    <div className="app">
      <Navbar onLogoClick={handleReset} theme={theme} onToggleTheme={handleToggleTheme} />

      {isOffline && (
        <div className="offline-banner">
          📶 You are offline — map tiles and trip planning require a connection. Recent trips are available below.
        </div>
      )}

      {installPrompt && (
        <div className="install-banner">
          <span>📲 Install EVPath on your device for quick access and offline maps</span>
          <button className="btn-install" onClick={handleInstall}>Install App</button>
          <button className="btn-install-dismiss" onClick={() => setInstallPrompt(false)}>✕</button>
        </div>
      )}

      {loading && (
        <div className="loading-section">
          <div className="loading-spinner" />
          <div className="loading-title">Planning your EV journey…</div>
          <div className="loading-sub">Fetching routes, charging stations &amp; amenities</div>
        </div>
      )}

      {!loading && !routes && (
        <div className="hero-section">
          <div className="hero-content">
            <span className="hero-badge">⚡ India's EV Intelligence Layer</span>
            <h1 className="hero-headline">
              Navigate Every Road.{' '}
              <span className="hero-accent">Charge with Confidence.</span>
            </h1>
            <p className="hero-sub">
              Real-time station data · Adaptive route planning · GPS navigation built for Indian roads
            </p>
          </div>

          {/* Recent trips quick-access bar */}
          {history.length > 0 && (
            <div className="recent-trips">
              <span className="recent-label">Recent:</span>
              <div className="recent-chips">
                {history.map(h => (
                  <button key={h.id} className="recent-chip" onClick={() => handleReplay(h)} title={`${h.origin} → ${h.destination}`}>
                    <span className="recent-route">
                      {h.origin.split(',')[0].trim()} → {h.destination.split(',')[0].trim()}
                    </span>
                    <span className="recent-meta">{relativeDate(h.date)}</span>
                  </button>
                ))}
              </div>
              <button className="recent-clear" onClick={clearHistory} title="Clear history">✕</button>
            </div>
          )}

          <div className="hero-form-card">
            <TripForm
              key={formKey}
              formKey={formKey}
              initialForm={initialForm}
              onSubmit={handlePlanTrip}
              loading={loading}
            />
            {error && <div className="error-banner"><strong>Error:</strong> {error}</div>}
          </div>

          <div className="hero-stats">
            <div className="hstat">
              <div className="hstat-val">100% Free</div>
              <div className="hstat-lbl">Always</div>
            </div>
            <div className="hstat-divider" />
            <div className="hstat">
              <div className="hstat-val">Live OCM Data</div>
              <div className="hstat-lbl">Charging stations</div>
            </div>
            <div className="hstat-divider" />
            <div className="hstat">
              <div className="hstat-val">3 Routes</div>
              <div className="hstat-lbl">Per trip</div>
            </div>
            <div className="hstat-divider" />
            <div className="hstat">
              <div className="hstat-val">GPS Nav</div>
              <div className="hstat-lbl">Turn-by-turn</div>
            </div>
          </div>
        </div>
      )}

      {!loading && routes && (
        <RouteResults
          routes={routes}
          tripMeta={tripMeta}
          batteryCapacityKwh={batteryKwh}
          formData={lastFormData}
          initialSelection={sharedSelection}
          onBack={handleReset}
          onRefine={handleRefine}
          onStartNav={handleStartNav}
        />
      )}
    </div>
  )
}

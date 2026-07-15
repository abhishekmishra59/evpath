import { useState, useEffect } from 'react'
import TripForm from './components/TripForm'
import RouteResults from './components/RouteResults'
import NavigationView from './components/NavigationView'
import { planTrip } from './services/api'

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

export default function App() {
  const [routes, setRoutes]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [tripMeta, setTripMeta]     = useState(null)
  const [navRoute, setNavRoute]     = useState(null)
  const [navStops, setNavStops]     = useState(null)
  const [batteryKwh, setBatteryKwh] = useState(60)
  const [theme, setTheme]           = useState(
    () => localStorage.getItem('evpath-theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('evpath-theme', theme)
  }, [theme])

  function handleToggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  async function handlePlanTrip(formData) {
    setLoading(true); setError(null); setRoutes(null)
    setBatteryKwh(formData.batteryCapacityKwh || 60)
    setTripMeta({ origin: formData.origin, destination: formData.destination })
    try {
      const result = await planTrip(formData)
      setRoutes(result)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to plan trip.')
    } finally {
      setLoading(false)
    }
  }

  function handleStartNav(route, selectedStops) {
    setNavRoute(route); setNavStops(selectedStops)
  }
  function handleExitNav() {
    setNavRoute(null); setNavStops(null)
  }
  function handleReset() {
    setRoutes(null); setError(null)
  }

  if (navRoute) {
    return <NavigationView route={navRoute} selectedStops={navStops} onExit={handleExitNav} />
  }

  return (
    <div className="app">
      <Navbar onLogoClick={handleReset} theme={theme} onToggleTheme={handleToggleTheme} />

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

          <div className="hero-form-card">
            <TripForm onSubmit={handlePlanTrip} loading={loading} />
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
          onBack={handleReset}
          onStartNav={handleStartNav}
        />
      )}
    </div>
  )
}

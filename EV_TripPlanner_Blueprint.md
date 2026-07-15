# EVPath — EV Trip Planner for India
## Implementation Blueprint (Claude-Ready)

**Version:** 1.0  
**Date:** 2026-07-01  
**Stack:** Free-tier APIs only  
**Target Platform:** Web (mobile-responsive)

---

## 1. Executive Summary

An EV trip planning web application for Indian EV users that accepts start/end locations and vehicle-specific inputs, then returns the **top 3 optimized routes** with charging stop recommendations, charger live status, amenity filters, and per-route trade-off analysis.

The entire stack uses **free, publicly available APIs** — no paid subscriptions required for MVP.

---

## 2. Problem Statement

Indian EV users face **range anxiety** — uncertainty about whether their battery will last between destinations, where to charge, how long it takes, and whether chargers are actually working. Existing map apps do not account for battery state, charging time, or charger availability.

This app solves:
- Which route is best for my vehicle's current range?
- Where exactly do I stop to charge, and for how long?
- Is that charger working right now?
- Does that charging station have food / restrooms / parking?

---

## 3. Core User Flow

```
User Inputs
    │
    ├── Start Location (text / GPS)
    ├── End Location (text)
    ├── Current Battery % 
    ├── Vehicle Range (km, full charge)
    ├── Connector Type (Type 2 / CCS2 / CHAdeMO / Bharat AC / Bharat DC)
    ├── Desired Charge Level at Destination (%)
    └── Filters: Food Court | Restroom | Parking | Fast Charger | 24x7

         ↓

Route Engine calculates 3 route options
    ├── Route 1: Fastest (minimum total time)
    ├── Route 2: Fewest Stops (minimize charging stops)
    └── Route 3: Best Amenities (highest comfort score)

         ↓

Each Route shows:
    ├── Total distance & estimated time (drive + charge)
    ├── Charging stops with:
    │     ├── Station name, address
    │     ├── Charger type & max power (kW)
    │     ├── Live status (Available / Busy / Offline)
    │     ├── Estimated charge time at that stop
    │     ├── Available amenities
    │     └── Cost estimate (if known)
    └── Pros & Cons summary for each route

         ↓

User selects a route → Full detail view + map
```

---

## 4. Free API Stack

| Purpose | API / Service | Free Tier Limit | Notes |
|---|---|---|---|
| Map rendering | **Leaflet.js + OpenStreetMap** | Unlimited | No API key needed |
| Geocoding (text → coordinates) | **Nominatim** (OSM) | 1 req/sec, no bulk | Add delay between calls |
| Routing (road path) | **OpenRouteService (ORS)** | 2,000 req/day | Requires free API key |
| EV Charging Stations | **OpenChargeMap API** | Free with API key | 50k+ stations in India |
| Points of Interest (food/amenities) | **Overpass API** (OSM) | Free, rate-limited | Query OSM POI data |
| Elevation data | **Open-Elevation API** | Free, self-hostable | For energy consumption model |
| Reverse geocoding | **Nominatim** | Same as above | Coordinates → address |

### API Key Registration Links
- OpenRouteService: https://openrouteservice.org/dev/#/signup
- OpenChargeMap: https://openchargemap.org/site/developerinfo

---

## 5. Application Architecture

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (React + Vite)             │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ TripForm    │  │ RouteResults │  │  MapView   │ │
│  │ Component  │  │  Component   │  │ (Leaflet)  │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│                                                      │
│         Axios HTTP calls to Backend API              │
└───────────────────────┬─────────────────────────────┘
                        │ REST API (JSON)
┌───────────────────────▼─────────────────────────────┐
│              BACKEND (Node.js + Express)             │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Route Planning Engine            │   │
│  │  1. Fetch candidate routes from ORS           │   │
│  │  2. Identify charging stops needed            │   │
│  │  3. Fetch nearby stations (OpenChargeMap)     │   │
│  │  4. Score & rank 3 route variants             │   │
│  │  5. Fetch amenities (Overpass API)            │   │
│  │  6. Build pros/cons for each route            │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌────────────────┐  ┌─────────────────────────┐    │
│  │  Station Cache │  │   Charger Status Layer  │    │
│  │  (in-memory /  │  │  (OpenChargeMap live    │    │
│  │   Redis)       │  │   status endpoint)      │    │
│  └────────────────┘  └─────────────────────────┘    │
└──────────────────────────────────────────────────────┘
         │              │               │
  OpenRouteService  OpenChargeMap   Overpass API
  (road routing)   (EV stations)   (amenities/POI)
```

### Component Responsibilities

**Frontend:**
- `TripForm` — collects all user inputs, validates, submits
- `RouteResults` — renders 3 route cards with pros/cons tabs
- `MapView` — Leaflet map showing route polyline + charging stop markers
- `StationCard` — individual charger detail with live status badge
- `FilterPanel` — amenity checkboxes, connector type selectors

**Backend:**
- `routes/trip.js` — POST /api/plan-trip (main endpoint)
- `services/routeEngine.js` — core EV routing algorithm
- `services/orsService.js` — OpenRouteService API wrapper
- `services/ocmService.js` — OpenChargeMap API wrapper
- `services/overpassService.js` — Overpass API for amenity lookup
- `services/nominatimService.js` — geocoding
- `utils/evCalculator.js` — battery consumption math
- `utils/scorer.js` — route scoring and pros/cons generator

---

## 6. EV Battery & Routing Algorithm

### 6.1 Key Inputs
```
vehicle_range_km        = full charge range (user input, e.g. 400)
current_battery_pct     = current charge % (e.g. 80)
current_range_km        = vehicle_range_km × (current_battery_pct / 100)
safety_buffer_pct       = 10%  (hardcoded — never go below 10%)
usable_range_km         = current_range_km × (1 - safety_buffer_pct)
target_battery_at_dest  = user input (e.g. 20%)
consumption_rate        = vehicle_range_km / full_battery_kwh  (km per kWh)
```

### 6.2 Route Generation Logic

```
Step 1: Get base route geometry from ORS (start → end)
Step 2: Extract waypoints every ~(usable_range_km × 0.8) km along route
Step 3: For each waypoint, query OpenChargeMap for stations within 5km
Step 4: Filter stations by connector type match
Step 5: Select best station at each charging stop (by charger power, status)
Step 6: Recalculate battery at each segment
Step 7: Calculate charge time at each stop:
          charge_time_min = ((target_charge - arrival_charge) × battery_kwh) / charger_kw × 60
Step 8: Repeat for 3 route variants with different scoring weights
```

### 6.3 Three Route Variants

| Route | Scoring Priority | Strategy |
|---|---|---|
| Route 1 "Fastest" | Minimize total time (drive + charge) | Prefer fast chargers (50kW+), accept slight detours |
| Route 2 "Fewest Stops" | Minimize number of charging stops | Charge to 90% at each stop, fewer interruptions |
| Route 3 "Best Amenities" | Maximize comfort score | Prioritize stations with food/restroom/parking |

### 6.4 Pros & Cons Generator

Each route auto-generates pros/cons based on metrics:

```javascript
// Example rules
if (route.totalTimeMin < otherRoutes.avgTime * 0.9)  → PRO: "Fastest route, saves X minutes"
if (route.chargingStops === 1)                        → PRO: "Only 1 charging stop"
if (route.chargingStops > 2)                          → CON: "Requires 3 charging stops"
if (route.hasOfflineCharger)                          → CON: "One charger reported offline"
if (route.amenityScore > 0.7)                         → PRO: "All stops have food & restrooms"
if (route.detourKm > 20)                              → CON: "Route adds 20km detour"
if (route.maxChargerKw >= 50)                         → PRO: "Fast charging available (50kW+)"
```

---

## 7. Data Models

### 7.1 Trip Request (POST body)
```json
{
  "origin": "Bangalore, Karnataka",
  "destination": "Hyderabad, Telangana",
  "currentBatteryPct": 85,
  "vehicleRangeKm": 400,
  "batteryCapacityKwh": 60,
  "connectorTypes": ["CCS2", "Type2"],
  "targetBatteryAtDestPct": 20,
  "filters": {
    "foodCourt": false,
    "restroom": true,
    "parking": true,
    "fastChargerOnly": false,
    "open24x7": false
  }
}
```

### 7.2 Route Response
```json
{
  "routes": [
    {
      "id": "route_1",
      "label": "Fastest",
      "totalDistanceKm": 572,
      "totalTimeMin": 420,
      "driveTimeMin": 360,
      "totalChargeTimeMin": 60,
      "chargingStops": [
        {
          "stopNumber": 1,
          "station": {
            "id": "ocm_123456",
            "name": "Tata Power EV - Highway Dhaba",
            "address": "NH 44, Kurnool, Andhra Pradesh",
            "lat": 15.8281,
            "lng": 78.0373,
            "maxChargerKw": 50,
            "connectors": ["CCS2", "Type2"],
            "status": "Available",
            "totalPoints": 4,
            "availablePoints": 2,
            "amenities": ["food_court", "restroom", "parking"],
            "operatorName": "Tata Power",
            "cost": "₹18/kWh",
            "lastStatusUpdate": "2026-07-01T10:30:00Z"
          },
          "arrivalBatteryPct": 18,
          "chargeTo": 80,
          "estimatedChargeTimeMin": 55,
          "kmFromStart": 280
        }
      ],
      "pros": [
        "Fastest total journey — saves 35 minutes vs other routes",
        "Fast 50kW charger available at stop"
      ],
      "cons": [
        "One charger reported as busy — possible wait time",
        "Limited food options at charging stop"
      ],
      "polyline": "encoded_polyline_string_here",
      "batteryProfile": [85, 18, 80, 42]
    }
  ]
}
```

### 7.3 Charger Status Model
```json
{
  "stationId": "ocm_123456",
  "status": "Available | Busy | Offline | Unknown",
  "availablePoints": 2,
  "totalPoints": 4,
  "lastChecked": "2026-07-01T10:30:00Z",
  "dataSource": "OpenChargeMap"
}
```

---

## 8. Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/plan-trip` | Main — returns 3 route options |
| GET | `/api/stations/nearby?lat=&lng=&radius=` | Charging stations near a point |
| GET | `/api/stations/:id/status` | Live status for a specific station |
| GET | `/api/geocode?q=` | Text → coordinates (Nominatim proxy) |
| GET | `/api/health` | Health check |

---

## 9. Frontend Screens

### Screen 1: Trip Planner Form
```
┌─────────────────────────────────────┐
│  ⚡ EV Trip Planner India           │
├─────────────────────────────────────┤
│  FROM: [ Bangalore, Karnataka     ] │
│  TO:   [ Hyderabad, Telangana     ] │
├─────────────────────────────────────┤
│  Current Battery: [====85%====]     │
│  Full Range: [ 400 ] km             │
│  Battery Capacity: [ 60 ] kWh       │
│  Arrive with at least: [ 20% ]      │
├─────────────────────────────────────┤
│  Connector: [CCS2 ▼] [+Add type]   │
├─────────────────────────────────────┤
│  FILTERS:                           │
│  ☑ Restroom  ☐ Food Court          │
│  ☑ Parking   ☐ Fast Charger Only   │
│  ☐ Open 24x7                        │
├─────────────────────────────────────┤
│       [ PLAN MY TRIP →  ]           │
└─────────────────────────────────────┘
```

### Screen 2: Route Results (3 Cards)
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ ⚡ FASTEST   │ │ 🛑 FEWEST    │ │ 🍽 BEST      │
│              │ │    STOPS     │ │  AMENITIES   │
│  7h 0m total │ │  7h 45m      │ │  7h 20m      │
│  572 km      │ │  572 km      │ │  591 km      │
│  1 stop      │ │  1 stop      │ │  2 stops     │
│              │ │              │ │              │
│  ✅ Fastest  │ │  ✅ 1 stop   │ │  ✅ Food at  │
│  ✅ 50kW DC  │ │  ✅ Charges  │ │    all stops │
│  ⚠️ Busy     │ │    to 90%    │ │  ✅ Open 24x7│
│    charger   │ │  ❌ Slower   │ │  ❌ 2 stops  │
│              │ │    charger   │ │  ❌ +19km    │
│  [SELECT]    │ │  [SELECT]    │ │  [SELECT]    │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Screen 3: Selected Route Detail
```
┌─────────────────────────────────────┐
│  MAP (Leaflet)                      │
│  [Route polyline]                   │
│  📍 Bangalore                       │
│     |                               │
│  ⚡ Kurnool (Stop 1) — charge 55min │
│     |                               │
│  📍 Hyderabad                       │
└─────────────────────────────────────┘
│  STOP 1 DETAILS                     │
│  Tata Power EV — Highway Dhaba      │
│  NH 44, Kurnool                     │
│  ● AVAILABLE (2/4 points free)      │
│  50kW DC Fast Charger (CCS2)        │
│  Arrive at 18% → Charge to 80%      │
│  Est. charge time: ~55 min          │
│  🍽 Food Court  🚻 Restroom 🅿 Park │
│  Cost: ₹18/kWh ≈ ₹565 this stop   │
└─────────────────────────────────────┘
```

---

## 10. Project File Structure

```
ev-trip-planner/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TripForm.jsx
│   │   │   ├── RouteResults.jsx
│   │   │   ├── RouteCard.jsx
│   │   │   ├── MapView.jsx
│   │   │   ├── StationCard.jsx
│   │   │   ├── BatteryIndicator.jsx
│   │   │   └── FilterPanel.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── TripDetail.jsx
│   │   ├── services/
│   │   │   └── api.js          (Axios calls to backend)
│   │   ├── utils/
│   │   │   └── mapHelpers.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── trip.js
│   │   │   ├── stations.js
│   │   │   └── geocode.js
│   │   ├── services/
│   │   │   ├── routeEngine.js      (core EV routing logic)
│   │   │   ├── orsService.js       (OpenRouteService)
│   │   │   ├── ocmService.js       (OpenChargeMap)
│   │   │   ├── overpassService.js  (OSM amenities)
│   │   │   └── nominatimService.js (geocoding)
│   │   ├── utils/
│   │   │   ├── evCalculator.js     (battery math)
│   │   │   └── scorer.js           (route scoring + pros/cons)
│   │   ├── middleware/
│   │   │   ├── rateLimiter.js      (protect free API limits)
│   │   │   └── cache.js            (in-memory cache)
│   │   └── app.js
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## 11. Environment Variables

```env
# backend/.env

# OpenRouteService (free key from openrouteservice.org)
ORS_API_KEY=your_ors_api_key_here

# OpenChargeMap (free key from openchargemap.org)
OCM_API_KEY=your_ocm_api_key_here

# Server
PORT=3001
NODE_ENV=development

# Cache TTL (seconds)
STATION_CACHE_TTL=300
ROUTE_CACHE_TTL=600

# Rate limiting
NOMINATIM_DELAY_MS=1100
```

```env
# frontend/.env
VITE_API_BASE_URL=http://localhost:3001
```

---

## 12. External API Usage Details

### 12.1 OpenRouteService (Routing)
```
Endpoint: https://api.openrouteservice.org/v2/directions/driving-car/json
Method: POST
Headers: Authorization: Bearer {ORS_API_KEY}
Body: {
  "coordinates": [[start_lng, start_lat], [end_lng, end_lat]],
  "instructions": false,
  "geometry": true,
  "elevation": true
}
Returns: Route geometry, distance, duration, elevation profile
Free limit: 2,000 requests/day, 40 req/min
```

### 12.2 OpenChargeMap (EV Stations)
```
Endpoint: https://api.openchargemap.io/v3/poi/
Method: GET
Params:
  key={OCM_API_KEY}
  latitude={lat}
  longitude={lng}
  distance=10          (km radius)
  distanceunit=KM
  countrycode=IN       (India only)
  maxresults=20
  connectiontypeid=    (filter by connector)
  statustype=50        (operational only — status ID 50 = Operational)
Returns: Array of charging stations with connectors, status, amenities
Free limit: No hard limit stated; use responsibly
```

### 12.3 Overpass API (Amenities near station)
```
Endpoint: https://overpass-api.de/api/interpreter
Method: POST
Query (example for food near a point):
  [out:json][timeout:10];
  (
    node["amenity"="restaurant"](around:500,{lat},{lng});
    node["amenity"="food_court"](around:500,{lat},{lng});
    node["amenity"="fast_food"](around:500,{lat},{lng});
    node["amenity"="toilets"](around:500,{lat},{lng});
    node["amenity"="parking"](around:500,{lat},{lng});
  );
  out body;
Free limit: Courtesy API — add 2-3 second delay between requests
```

### 12.4 Nominatim (Geocoding)
```
Endpoint: https://nominatim.openstreetmap.org/search
Method: GET
Params:
  q={search_text}
  format=json
  countrycodes=in
  limit=5
  addressdetails=1
Headers: User-Agent: EVTripPlanner/1.0 (your@email.com)  ← REQUIRED
Free limit: 1 request/second max — mandatory User-Agent header
```

---

## 13. Key Implementation Notes for Claude

When implementing, follow these rules:

### Rate Limiting (Critical)
- Nominatim: Always add `1100ms` delay between requests. Violating this gets your IP blocked.
- Overpass: Add `2000ms` delay. Cache results aggressively.
- ORS: 40 req/min — add a simple token bucket or queue.

### Caching Strategy
- Cache charging station results for **5 minutes** (stations don't move)
- Cache route geometry for **10 minutes** (roads don't change)
- **Never cache live charger status** — always fetch fresh

### OpenChargeMap Status Codes
```
StatusType.ID values:
  0  = Unknown
  10 = Currently Available
  20 = Currently Occupied/In Use  
  30 = Operational
  50 = Partially Operational
  75 = Temporarily Unavailable
  100 = Abandoned
  150 = Planned for Future Date
Display as: 10/30 → "Available" | 20/50 → "Busy" | 75/100 → "Offline"
```

### OpenChargeMap Connector Type IDs (India relevant)
```
Type 2 (Mennekes AC)  → ConnectionTypeID: 25
CCS Type 2 (DC)       → ConnectionTypeID: 33
CHAdeMO               → ConnectionTypeID: 2
Bharat AC-001         → ConnectionTypeID: 1036
Bharat DC-001         → ConnectionTypeID: 1037
Type 1 (J1772)        → ConnectionTypeID: 1
```

### Battery Calculation Formula
```javascript
function calculateEnergyForSegment(distanceKm, elevationGainM, vehicleRangeKm, batteryKwh) {
  const baseConsumption = batteryKwh / vehicleRangeKm;        // kWh/km
  const elevationPenalty = (elevationGainM * 0.003);          // ~3Wh per meter gain
  const energyKwh = (distanceKm * baseConsumption) + (elevationPenalty / 1000);
  return energyKwh;
}

function batteryAfterSegment(currentPct, energyKwh, batteryKwh) {
  const percentUsed = (energyKwh / batteryKwh) * 100;
  return Math.max(0, currentPct - percentUsed);
}
```

### Charging Time Formula
```javascript
function estimateChargeTimeMin(fromPct, toPct, batteryKwh, chargerKw) {
  const chargingEfficiency = 0.90;  // 90% efficiency
  const kwhNeeded = ((toPct - fromPct) / 100) * batteryKwh;
  const effectiveKw = chargerKw * chargingEfficiency;
  // DC fast charging slows above 80% (apply taper)
  const taperFactor = toPct > 80 ? 1.4 : 1.0;
  return (kwhNeeded / effectiveKw) * 60 * taperFactor;
}
```

---

## 14. Implementation Phases

### Phase 1 — Backend Core (Week 1-2)
**Goal:** Working API that returns route data

Tasks:
- [ ] Initialize Node.js + Express project
- [ ] Create Nominatim geocoding service
- [ ] Create ORS routing service (get road path between two points)
- [ ] Create OpenChargeMap service (fetch stations near a coordinate)
- [ ] Build `evCalculator.js` with battery math functions
- [ ] Build basic `routeEngine.js` — single route with charging stops
- [ ] Expose POST `/api/plan-trip` endpoint
- [ ] Add in-memory caching and rate limiter middleware
- [ ] Test with Bangalore → Hyderabad example

**Claude prompt for this phase:**
> "Build the Node.js/Express backend for an EV trip planner. Start with the project structure defined in the blueprint. Implement Phase 1: geocoding service (Nominatim), routing service (OpenRouteService API), charging station service (OpenChargeMap API), battery calculator utility, and the basic route engine. Expose POST /api/plan-trip. Follow the rate limiting rules for each API."

---

### Phase 2 — Route Variants & Scoring (Week 2-3)
**Goal:** Generate all 3 route types with pros/cons

Tasks:
- [ ] Implement 3 route variant strategies in `routeEngine.js`
- [ ] Build `scorer.js` with weighted scoring logic
- [ ] Implement pros/cons auto-generation rules
- [ ] Add Overpass API integration for amenity lookup
- [ ] Match amenities to user filter criteria
- [ ] Test and validate scoring produces meaningfully different routes

**Claude prompt for this phase:**
> "Extend the EV trip planner backend. Implement the three route variants (Fastest, Fewest Stops, Best Amenities) in routeEngine.js using the scoring weights from the blueprint. Build scorer.js with the pros/cons generation rules. Add the Overpass API service to fetch amenities near each charging station and match them against user filters."

---

### Phase 3 — Frontend (Week 3-4)
**Goal:** Working UI with map

Tasks:
- [ ] Initialize React + Vite project
- [ ] Build `TripForm` component with all inputs and validation
- [ ] Build `RouteResults` with 3 route cards
- [ ] Integrate Leaflet.js for map display (route polyline + markers)
- [ ] Build `StationCard` with live status badge
- [ ] Build `BatteryIndicator` visual component
- [ ] Wire up Axios calls to backend API
- [ ] Add loading states and error handling
- [ ] Make fully mobile-responsive

**Claude prompt for this phase:**
> "Build the React frontend for the EV trip planner using Vite. Use Leaflet.js with OpenStreetMap tiles for the map. Implement the components: TripForm, RouteResults (3 route cards with pros/cons), MapView (route polyline + charging stop markers), and StationCard with Available/Busy/Offline status badges. Follow the UI wireframes in the blueprint. Use Axios to call the backend at VITE_API_BASE_URL."

---

### Phase 4 — Polish & Edge Cases (Week 4-5)
**Goal:** Production-ready robustness

Tasks:
- [ ] Handle "no charging stations found" gracefully
- [ ] Handle routes shorter than vehicle range (no stops needed)
- [ ] Add charger status refresh button (poll every 2 min on detail screen)
- [ ] Add trip cost estimator (₹ per kWh × kWh charged)
- [ ] Add "Share Trip" URL with encoded params
- [ ] Add popular Indian city autocomplete suggestions
- [ ] Performance: lazy load map, debounce geocoding input
- [ ] Add disclaimer about data accuracy (OpenChargeMap is community data)

**Claude prompt for this phase:**
> "Polish the EV trip planner application. Handle edge cases: routes shorter than vehicle range (skip charging stops), no stations found within range (show warning with nearest station), and network API failures (graceful fallback messages). Add charger status auto-refresh every 2 minutes on the detail screen. Add a trip cost estimator. Ensure full mobile responsiveness."

---

## 15. Known Limitations & Mitigations

| Limitation | Impact | Mitigation |
|---|---|---|
| OpenChargeMap has incomplete India data | Some stations missing | Show "data may be incomplete" disclaimer; allow user to report missing stations |
| Live charger status is community-reported, not real-time | Status may be stale | Show `last updated` timestamp; highlight if >2 hours old |
| ORS free tier: 2000 req/day | Limits production traffic | Cache aggressively; add queue; upgrade to paid if needed |
| Nominatim: 1 req/sec | Slow geocoding for autocomplete | Debounce input at 500ms; cache results |
| No traffic data in free tier | Drive time estimates may be off | Show estimated time as "approx." range; suggest leaving buffer |
| Battery consumption varies by AC/speed/load | Range calculation is approximate | Use 15% safety buffer; show "estimated" labels |

---

## 16. Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + Vite |
| Map Library | Leaflet.js 1.9 |
| Map Tiles | OpenStreetMap (free, no key) |
| HTTP Client (frontend) | Axios |
| Styling | Tailwind CSS |
| Backend Framework | Node.js 20 + Express 4 |
| HTTP Client (backend) | Axios |
| Caching | node-cache (in-memory) |
| Rate Limiting | express-rate-limit + bottleneck |
| Environment | dotenv |
| Dev Tools | nodemon, concurrently |
| External APIs | OpenRouteService, OpenChargeMap, Overpass API, Nominatim |

---

## 17. Getting Started (Bootstrap Commands)

```bash
# Create project
mkdir ev-trip-planner && cd ev-trip-planner

# Backend setup
mkdir backend && cd backend
npm init -y
npm install express axios node-cache express-rate-limit bottleneck dotenv cors
npm install -D nodemon
cd ..

# Frontend setup
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios leaflet react-leaflet
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
cd ..

# Run both (from root)
npm install -D concurrently
# Add to root package.json scripts:
# "dev": "concurrently \"cd backend && npm run dev\" \"cd frontend && npm run dev\""
```

---

## 18. Success Criteria for MVP

- [ ] User can enter start/end location in India and get 3 route options
- [ ] Each route correctly identifies charging stops based on vehicle range
- [ ] Charging stops show live status (Available / Busy / Offline)
- [ ] Amenity filters correctly influence route selection
- [ ] Map shows route polyline with charging stop markers
- [ ] Pros/cons are meaningful and differentiate the 3 routes
- [ ] Application works on mobile browser
- [ ] Graceful error handling for API failures

---

*Document end. This blueprint is ready to be used as implementation input for Claude.*

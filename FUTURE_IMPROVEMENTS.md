# EVPath — Future Improvements

## User Experience

### Saved Trips / History
- Use `localStorage` to remember recent routes
- One-tap re-plan without re-entering details

### Vehicle Profiles
- Save your car (Tata Nexon EV, MG ZS EV, etc.) with range and battery size
- Eliminates re-entering vehicle details every trip

### Waypoints
- Add intermediate stops ("I want to pass through Lonavala") along a route

### Trip Sharing
- Generate a shareable URL with the trip encoded
- Co-travellers can open the exact same route plan

---

## Smarter Route Intelligence

### Real Traffic Awareness
- OpenRouteService supports traffic-adjusted routing; ensure it is fully utilized

### Weather Impact on Range
- AC usage in summer / heater in winter reduces real range by 15–30%
- Factor seasonal weather into stop calculations

### Charging Speed-Aware Stops
- Prefer fast chargers (DC) on long trips
- Suggest slow (AC) chargers only near the destination

### Amenity Scoring
- Rank charging stops by nearby amenities (food, restrooms, hotels)
- Use OpenStreetMap POI data via ORS (partially available already)

---

## Data & Reliability

### Station Availability Caching
- OCM data can be stale; show a "last verified" timestamp
- Allow users to report a station as offline

### User-Contributed Station Reviews
- Simple thumbs up/down on a station after a trip
- Store in a lightweight DB (e.g., Supabase free tier)

### Multiple EV Network Support
- Add Tata Power, EESL, Statiq, ChargeZone as named networks
- Let users filter by preferred network

---

## Technical / Performance

### Progressive Web App (PWA)
- Add service worker + web manifest
- Enables phone installation and offline access to cached routes

### Backend Caching Improvement
- Current: in-memory (`node-cache`) — lost on server restart
- Swap to Redis (Upstash free tier) so cache survives Render restarts

### Route Pre-computation
- Pre-cache popular city pairs (Mumbai↔Pune, Delhi↔Agra) nightly
- Makes those trips near-instant for users

---

## Top 3 Highest-Impact Picks

| Priority | Feature | Reason |
|----------|---------|--------|
| 1 | **Vehicle Profiles** | Biggest UX friction — users re-enter car details every trip |
| 2 | **PWA / Installable** | Feels like a real mobile app; works offline for saved routes |
| 3 | **Station Status Reporting** | OCM data is often outdated; user-reported status builds trust |

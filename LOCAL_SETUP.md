# EVPath — Local Development Setup

## Prerequisites

Install the following software before you begin.

### 1. Node.js (v18 or later)

Download from [nodejs.org](https://nodejs.org) — choose the **LTS** version.

Verify installation:

```powershell
node -v   # should print v18.x.x or higher
npm -v    # should print 9.x.x or higher
```

### 2. Git

Download from [git-scm.com](https://git-scm.com).

Verify installation:

```powershell
git --version
```

### 3. API Keys (free accounts)

| Service | Sign-up URL | What it's used for |
|---------|-------------|-------------------|
| **OpenRouteService** | [openrouteservice.org](https://openrouteservice.org/dev/#/signup) | Route calculation |
| **OpenChargeMap** | [openchargemap.org/site/developerinfo](https://openchargemap.org/site/developerinfo) | EV charging stations |

Both are free. Copy your API keys — you will need them in step 3 below.

> Nominatim (geocoding / address search) is used without a key — no sign-up needed.

---

## Project Structure

```
evpath/
├── backend/    ← Node.js + Express API server
└── frontend/   ← React + Vite web app
```

Both must run simultaneously in separate terminals.

---

## Step 1 — Clone the Repository

```powershell
git clone https://github.com/YOUR_USERNAME/evpath.git
cd evpath
```

---

## Step 2 — Set Up the Backend

```powershell
cd backend
npm install
```

Create the environment file by copying the example:

```powershell
copy .env.example .env
```

Open `.env` in any text editor and fill in your API keys:

```env
ORS_API_KEY=paste_your_openrouteservice_key_here
OCM_API_KEY=paste_your_openchargemap_key_here
PORT=3001
NODE_ENV=development
STATION_CACHE_TTL=300
ROUTE_CACHE_TTL=600
NOMINATIM_DELAY_MS=1100
```

---

## Step 3 — Set Up the Frontend

Open a **second terminal**, then:

```powershell
cd evpath/frontend
npm install
```

The frontend already has a `.env` file pointing at the local backend:

```env
VITE_API_BASE_URL=http://localhost:3001
```

No changes needed here for local development.

---

## Step 4 — Start the Application

You need **two terminals running at the same time**.

### Terminal 1 — Backend

```powershell
cd evpath/backend
npm run dev
```

Expected output:

```
[EVPath] Server running on port 3001
```

The `dev` script uses `nodemon`, which auto-restarts the server whenever you save a backend file.

### Terminal 2 — Frontend

```powershell
cd evpath/frontend
npm run dev
```

Expected output:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Quick Reference

| Command | Directory | What it does |
|---------|-----------|--------------|
| `npm install` | `backend/` | Install backend dependencies |
| `npm run dev` | `backend/` | Start backend with auto-reload |
| `npm start` | `backend/` | Start backend without auto-reload |
| `npm install` | `frontend/` | Install frontend dependencies |
| `npm run dev` | `frontend/` | Start frontend dev server |
| `npm run build` | `frontend/` | Build frontend for production |
| `npm run preview` | `frontend/` | Preview the production build locally |

---

## Verify Everything is Working

1. Backend health check — open in browser or run:

   ```powershell
   Invoke-WebRequest http://localhost:3001/api/health | Select-Object -ExpandProperty Content
   ```

   Expected:

   ```json
   { "status": "ok", "app": "EVPath", "version": "1.0.0" }
   ```

2. Frontend — open [http://localhost:5173](http://localhost:5173) and plan a trip (e.g. Mumbai → Pune).

---

## Troubleshooting

**`npm run dev` fails — "nodemon: command not found"**

Run `npm install` inside the `backend/` folder first. `nodemon` is a dev dependency and must be installed locally.

**Backend starts but trips always fail**

- Open `backend/.env` and confirm both API keys are filled in (not the placeholder text).
- Check the terminal running the backend for error messages.

**Frontend shows "Failed to plan trip" / network error**

- Confirm the backend is running on port 3001.
- Confirm `frontend/.env` contains `VITE_API_BASE_URL=http://localhost:3001`.
- Check the browser DevTools → Network tab for the failing request.

**Port 3001 already in use**

Change `PORT=3002` in `backend/.env`, then update `frontend/.env` to `VITE_API_BASE_URL=http://localhost:3002`, and restart both servers.

**On a corporate network — SSL/TLS errors in backend**

The backend automatically disables strict TLS verification when `NODE_ENV=development`. Make sure `NODE_ENV` is set to `development` (not `production`) in `backend/.env`.

**Map tiles not loading**

This requires internet access. Leaflet pulls tiles from OpenStreetMap — ensure your network allows outbound HTTPS to `tile.openstreetmap.org`.

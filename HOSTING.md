# Hosting EVPath for Free

## Architecture

| Layer | Platform | Cost |
|-------|----------|------|
| Backend (Node.js + Express) | [Render.com](https://render.com) | Free |
| Frontend (React + Vite) | [Vercel](https://vercel.com) | Free |

No credit card required for either platform.

---

## Prerequisites

- A [GitHub](https://github.com) account
- Your API keys (from `evpath/backend/.env`):
  - `ORS_API_KEY` — OpenRouteService
  - `OCM_API_KEY` — OpenChargeMap

---

## Phase 1 — Push Code to GitHub

### 1.1 Create a GitHub repository

1. Go to [github.com](https://github.com) → click **New repository**
2. Name it `evpath`
3. Set visibility to **Private** (keeps your API keys safer)
4. Click **Create repository**

### 1.2 Push your local code

Open PowerShell and run:

```powershell
cd "c:\Users\abhishek.mishra59\OneDrive - Infosys Limited\DEsktop\demoClaude\evpath"

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/evpath.git
git push -u origin main
```

> Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Phase 2 — Deploy Backend on Render.com

### 2.1 Create an account

Go to [render.com](https://render.com) and sign up using **Continue with GitHub**.

### 2.2 Create a Web Service

1. Click **New → Web Service**
2. Select **Connect a repository** → choose your `evpath` repo
3. Set the following:

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node src/app.js` |
| **Instance Type** | `Free` |

### 2.3 Add environment variables

In the **Environment** tab, add each of these:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `ORS_API_KEY` | *(paste your OpenRouteService key)* |
| `OCM_API_KEY` | *(paste your OpenChargeMap key)* |
| `NOMINATIM_DELAY_MS` | `1100` |
| `STATION_CACHE_TTL` | `300` |
| `ROUTE_CACHE_TTL` | `3600` |

### 2.4 Deploy

Click **Create Web Service**. Render will install dependencies and start the server (~2 minutes).

When done, you will receive a backend URL like:
```
https://evpath-backend.onrender.com
```

### 2.5 Verify the backend is live

Open this URL in your browser:
```
https://evpath-backend.onrender.com/api/health
```

Expected response:
```json
{ "status": "ok", "app": "EVPath", "version": "1.0.0" }
```

---

## Phase 3 — Deploy Frontend on Vercel

### 3.1 Create an account

Go to [vercel.com](https://vercel.com) and sign up using **Continue with GitHub**.

### 3.2 Import your project

1. Click **New Project**
2. Find your `evpath` repo and click **Import**
3. Set the following:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 3.3 Add environment variable

In the **Environment Variables** section, add:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://evpath-backend.onrender.com` |

> Use your actual Render backend URL from Phase 2.4.

### 3.4 Deploy

Click **Deploy**. Vercel builds the React app and deploys it (~1 minute).

When done, you will receive a frontend URL like:
```
https://evpath.vercel.app
```

Open it in your browser — EVPath is now live.

---

## Deployed URLs Summary

| Service | URL |
|---------|-----|
| Frontend | `https://evpath.vercel.app` |
| Backend API | `https://evpath-backend.onrender.com` |
| Health check | `https://evpath-backend.onrender.com/api/health` |

---

## Keeping the Backend Awake (Optional)

Render's free tier **sleeps after 15 minutes of inactivity**. The first request after sleeping takes ~30 seconds to wake up.

To keep it awake 24/7 for free:

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account
2. Click **New Monitor**
3. Set:

| Setting | Value |
|---------|-------|
| **Monitor Type** | `HTTP(s)` |
| **Friendly Name** | `EVPath Backend` |
| **URL** | `https://evpath-backend.onrender.com/api/health` |
| **Monitoring Interval** | `Every 14 minutes` |

4. Click **Create Monitor**

UptimeRobot will ping the backend every 14 minutes, preventing it from sleeping. It also alerts you by email if the backend goes down.

---

## Updating the App After Code Changes

### Update backend (Render auto-deploys on git push)

```powershell
git add .
git commit -m "your change description"
git push
```

Render detects the push and redeploys automatically.

### Update frontend (Vercel auto-deploys on git push)

Same — just `git push`. Vercel redeploys within ~1 minute.

---

## Environment Variables Reference

### Backend (set in Render dashboard)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Set to `production` for live deployment | — |
| `ORS_API_KEY` | OpenRouteService API key | — |
| `OCM_API_KEY` | OpenChargeMap API key | — |
| `PORT` | Server port (Render sets this automatically) | `3001` |
| `NOMINATIM_DELAY_MS` | Delay between Nominatim geocoding calls (ms) | `1100` |
| `STATION_CACHE_TTL` | Station data cache duration (seconds) | `300` |
| `ROUTE_CACHE_TTL` | Route cache duration (seconds) | `3600` |

### Frontend (set in Vercel dashboard)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Full URL of the deployed backend (no trailing slash) |

---

## Free Tier Limits

| Platform | Limit |
|----------|-------|
| Render | 750 hours/month compute, sleeps after 15 min inactivity |
| Vercel | 100 GB bandwidth/month, unlimited deployments |
| OpenRouteService | 2,000 requests/day, 40 requests/minute |
| OpenChargeMap | Generous free tier (community API) |
| Nominatim | 1 request/second (enforced in code) |

---

## Troubleshooting

**Backend not responding**
- Check Render dashboard → Logs tab for errors
- Verify all environment variables are set correctly
- Test the health endpoint: `/api/health`

**Frontend shows "Failed to plan trip"**
- Confirm `VITE_API_BASE_URL` in Vercel matches your Render URL exactly (no trailing slash)
- Check the browser DevTools → Network tab for the failed request URL

**CORS error in browser console**
- Ensure `VITE_API_BASE_URL` is set — if missing, the frontend tries `http://localhost:3001` which fails in production

**Render deploy fails**
- Confirm **Root Directory** is set to `backend` in Render settings
- Check that `package.json` exists inside the `backend` folder

**Vercel build fails**
- Confirm **Root Directory** is set to `frontend` in Vercel settings
- Check that `vite.config.js` exists inside the `frontend` folder

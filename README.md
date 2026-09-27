# GeoLock

**Leave a message locked to a place. Only people physically there — with the right key — can read it.**

GeoLock is a geofenced messaging app. A **drop** is content locked to a geographic zone: to read it you must be standing inside the zone (verified server-side with PostGIS), and — if the creator set one — you must also know the drop's key. Neither factor alone is enough. Knowing the key from another city gets you nothing; standing in the zone without the key gets you nothing.

**Canonical use case:** a festival organiser drops a message covering the festival grounds, sets a key, and prints it on wristbands. Attendees open the app, walk in, type the key, and the content unlocks.

Built by [Softwarean™](https://softwarean.com). Full design rationale and ADRs live in [SPEC.md](./SPEC.md).

## Features

- 🗺️ **Full-screen Leaflet map** (OpenStreetMap tiles) with live location search (Nominatim)
- 📍 **Create drops** by tapping the map — radius slider (50 m – 20 km) with live circle preview, optional title, optional bcrypt key, expiry from 1 hour to 7 days
- 🔒 **Two-factor spatial gate** — PostGIS zone containment + optional shared key
- 📡 **GPS-tolerant zones** — the zone is widened by the device's reported accuracy (capped at 50 m) so real phones don't fail the boundary check
- 🕐 **Dual-timer expiry** — an absolute hard expiry, plus a rolling 1-hour visibility window that refreshes on every successful unlock
- 👁️ **Owner view** (`/owner/:slug`) — attempt count and a mini-map of every unlock attempt (green = granted, red = denied), via a one-time owner token. No accounts anywhere.
- 🧹 **Self-cleaning** — a cron deletes expired drops every 10 minutes
- ⏱️ **Rate-limited API** — 60 req/min globally, 20 req/min on the unlock gate
- 📱 Mobile-first UI with a two-step create flow and slide-up sheets

## Stack

| Piece | Tech |
|---|---|
| Server | Node.js ≥ 20, Fastify v5, TypeScript, `pg`, bcrypt |
| Database | PostgreSQL 16 + PostGIS 3.x (`postgis/postgis:16-3.4`) |
| Web | React 18, Vite, TypeScript, Leaflet + OSM tiles, Nominatim search |
| Tooling | pnpm workspaces, tsx (dev), tsup (build) |

## Repository layout

```
packages/
  server/                 Fastify API
    src/
      routes/             drops.create / read / nearby / attempts / delete
      db/                 pg pool client, schema.sql, migrate.ts
      lib/                spatial (GPS tolerance), key (bcrypt), expiry, slug, cleanup
  web/                    React SPA
    src/
      components/         Map, CreatePanel, DropSheet, OwnerView, LocationSearch, …
      hooks/              useGeolocation, useNearbyDrops
      lib/                api client, localStorage helpers
SPEC.md                   Project spec + ADRs
```

## Getting started

Prerequisites: **Node.js ≥ 20**, **pnpm**, and **Docker** (or any PostgreSQL 16 with PostGIS 3).

```bash
# 1. Install dependencies
pnpm install

# 2. Start a dedicated Postgres + PostGIS container
docker run -d --name geolock-db \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=geolock \
  -p 5434:5432 \
  postgis/postgis:16-3.4

# 3. Configure the server (repo root .env)
echo 'DATABASE_URL=postgresql://postgres:devpassword@localhost:5434/geolock' > .env

# 4. Apply the schema (PostGIS extension, tables, GiST index)
pnpm -C packages/server migrate

# 5. Run the API (:3000) and the web app (:5173)
pnpm -C packages/server dev
pnpm -C packages/web dev
```

Open http://localhost:5173, allow geolocation, and drop your first pin.

### Environment variables

| Variable | Package | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | server | `postgresql://localhost/geolock` | Postgres connection string |
| `PORT` | server | `3000` | API port |
| `FRONTEND_ORIGIN` | server | `http://localhost:5173` | CORS origin |
| `VITE_API_URL` | web | `http://localhost:3000` | API base URL |

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/drops` | Create a drop → returns `slug` + one-time `owner_token` |
| `GET` | `/drops/nearby?lat=&lng=&radius_m=&accuracy=` | Pins near a coordinate — coordinates only, no content, no slugs for zones you're outside |
| `GET` | `/drops/:slug?lat=&lng=&key=&accuracy=` | Read a drop — the spatial + key gate |
| `GET` | `/drops/:slug/attempts` | Attempt log (requires `x-owner-token` header) |
| `DELETE` | `/drops/:slug` | Hard-delete drop + attempts (requires `x-owner-token` header) |

A 60-second tour:

```bash
# Create a drop near Manhattan, 150 m radius, no key
curl -s -X POST localhost:3000/drops -H 'content-type: application/json' \
  -d '{"title":"Hello from NY","content":"You made it.","lat":40.79531,"lng":-74.05884,"radius_m":150}'
# → 201 {"slug":"cracked-sphere-97","owner_token":"84b1403f-…","expires_at":"…"}

# Discover it (returns coordinates only — the slug is withheld unless you're inside)
curl -s 'localhost:3000/drops/nearby?lat=40.79531&lng=-74.05884&radius_m=20000'
# → {"drops":[{"id":"…","lat":40.79531,"lng":-74.05884,"has_key":false,"you_are_inside":true,…}]}

# Unlock it from inside the zone
curl -s 'localhost:3000/drops/cracked-sphere-97?lat=40.7954&lng=-74.0590'
# → 200 {"title":"Hello from NY","content":"You made it.","content_type":"text/plain"}

# From outside the zone: 403 {"error":"outside_zone"} — and the attempt is logged
# Wrong key (if one is set): 403 {"error":"wrong_key"}
# Past expiry: 410 {"error":"expired"}

# Owner: view every attempt, then delete
curl -s localhost:3000/drops/cracked-sphere-97/attempts -H 'x-owner-token: <token>'
curl -s -X DELETE localhost:3000/drops/cracked-sphere-97 -H 'x-owner-token: <token>'   # → 204
```

## How the spatial gate works

1. **Create** — the point is buffered into a circle with `ST_Buffer(point::geography, radius_m)` and stored as `geography(Polygon, 4326)` (WGS84), so all math happens in true metres on the Earth's surface. A GiST index on `drop_zone` backs the lookups.
2. **Discover** — `/drops/nearby` uses `ST_DWithin(zone, point, radius + tolerance)`. It leaks only coordinates and a `has_key` flag; slugs are returned only for zones you're already inside, so there's no deep-linking from afar.
3. **Unlock** — `/drops/:slug` checks location first (`ST_DWithin` widened by GPS tolerance), then the key (bcrypt compare). The order is deliberate: an attacker probing keys from the wrong city learns nothing. Every attempt — `granted`, `outside_zone`, `wrong_key`, `expired` — is written to `access_attempts` with its coordinates.
4. **Expire** — `hard_expires_at` is the absolute cap (1 h – 7 days, creator's choice). `view_expires_at` is a rolling 1-hour window, refreshed on every successful unlock. A cron removes drops past either timer every 10 minutes.

## Implementation notes

- **`ST_MakePoint(longitude, latitude)`** — PostGIS takes (x, y) = (lng, lat), the opposite of the API's `lat`/`lng` naming. Every call site orders arguments explicitly; don't "fix" them.
- **World-copy coordinates** — Leaflet reports raw, unwrapped longitudes when a click lands on a repeated world copy (panning past ±180° or clicking at low zoom). The web client normalises pins with `e.latlng.wrap()`; the server additionally validates `Number.isFinite` + range (`lat ±90`, `lng ±180`) so bad input can never reach PostGIS.
- **Radius floor is 50 m** — deliberately ≥ the 50 m GPS-tolerance cap, so a zone can never be smaller than the tolerance applied against it.
- **Keys are bcrypt-hashed** (cost 10). The raw key exists only in the creation response; if the creator loses it, it is unrecoverable.
- **No accounts** — ownership is a UUID `owner_token` returned once at creation and kept in localStorage. Clearing localStorage forfeits owner access.

## Limitations & security posture

Client-reported GPS is trivially spoofable in a browser — that's exactly why the key exists as a second factor (see ADR-04). Location is an *access* control and a UX mechanic, not a cryptographic guarantee; the production hardening path (signed location attestation) is outlined in SPEC.md.

## Production build

```bash
pnpm -C packages/server build && pnpm -C packages/server start   # tsup → dist/, node dist/server.js
pnpm -C packages/web build                                       # tsc + vite → dist/
```


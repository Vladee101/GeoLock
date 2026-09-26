# GeoLock — Project Specification

**One-line pitch:** Leave a message locked to a place. Only people physically there — with the right key — can read it.

**Domain:** `geolock.app`
**Author:** Vlad / Softwarean™
**Stack:** Node.js + Fastify v5 · PostgreSQL 16 + PostGIS 3.x · React 18 + Vite + Leaflet · TypeScript throughout · pnpm (standalone repo)
**Deploy:** VPS at `91.229.91.234`, separate port from pastebin.monster, separate nginx upstream
**Portfolio angle:** Spatial access control as two-factor authentication — *somewhere you are* (PostGIS `ST_Within`) + *something you know* (shared key) as layered business logic

---

## Core mechanic

A **drop** is content locked to a geographic zone. To unlock it:

1. You must be physically inside the drop zone (verified by `ST_Within` against client-reported GPS)
2. If the drop has a key, you must provide it (verified by bcrypt compare server-side)

Neither condition alone is sufficient. Knowing the key from Oslo but being in the wrong city gets you nothing. Standing inside the zone without the key gets you nothing.

**Canonical use case:** A festival organiser creates a drop covering the festival grounds, sets a key, and announces it on a wristband or at the gate. Attendees open geolock.app, walk in, type the key, and the content unlocks.

---

## ADRs

### ADR-01 — Standalone repo, not monorepo
**Context:** pastebin.monster uses SQLite + better-sqlite3. GeoLock requires PostgreSQL + PostGIS.
**Decision:** Independent repo, independent deploy, same VPS. No shared code. Slug generation logic is simple enough to duplicate.
**Consequence:** Zero migration risk to pastebin.monster. Two distinct portfolio entries with clearly different data layers.

### ADR-02 — PostgreSQL 16 + PostGIS 3.x
**Context:** The core mechanic requires spatial containment queries.
**Decision:** PostgreSQL + PostGIS. SpatiaLite (SQLite spatial) exists but is less capable and less recognisable on a portfolio.
**Consequence:** Requires PostgreSQL on VPS. One `apt install postgis` and `CREATE EXTENSION postgis`.

### ADR-03 — geography(Polygon, 4326), not geometry
**Context:** Drop zones are defined by real GPS coordinates spanning real distances.
**Decision:** All spatial columns use `geography` type with SRID 4326 (WGS84). Calculations are accurate in meters on the Earth's surface.
**Consequence:** Slightly slower than `geometry` for some operations. Acceptable at this scale. Eliminates an entire class of CRS mismatch bugs.

### ADR-04 — Two-factor spatial gate: location + key
**Context:** Client-reported GPS is trivially spoofable in a browser.
**Decision:** Optional bcrypt-hashed key stored on the drop. Gate checks location first, then key. Order is intentional — a wrong-city attacker probing keys learns nothing. Key is distributed through a real-world channel by the creator (wristband, chalkboard, announcement).
**Consequence:** Casual GPS spoofing is neutralised. Key sharing by a legitimate visitor is an accepted limitation, equivalent to sharing a door code. Production hardening path (signed location tokens) documented in README.

### ADR-05 — Polygon zones, circle UI
**Context:** `ST_Buffer(point, radius)` builds a circle. Storing as `geography(Polygon)` supports arbitrary shapes later.
**Decision:** Store `drop_zone` as `geography(Polygon, 4326)`, built with `ST_Buffer` in v1. UI exposes a radius slider that previews the circle on the map. Freehand polygon drawing deferred to v2.
**Consequence:** Schema supports future irregular zones (building footprint, park section) with no migration.

### ADR-06 — Dual-timer expiry
**Context:** Inherited from pastebin.monster. Keeps the database clean, adds urgency.
**Decision:** `hard_expires_at` (24h default, creator-configurable up to 7 days). `view_expires_at` reset to +1h on each successful read. A drop nobody finds auto-deletes. A drop being actively read stays alive.
**Consequence:** Nightly cleanup cron. Expired drops return 410 Gone.

### ADR-07 — Leaflet over MapLibre GL
**Context:** Map needs to display pins and a circle preview. No vector tiles, no custom styling required.
**Decision:** Leaflet 1.x with OpenStreetMap tiles. Lighter, simpler API, sufficient for the use case.
**Consequence:** If v2 needs vector tile styling or large dataset rendering, migrate to MapLibre GL at that point.

### ADR-08 — Key stored as bcrypt hash, never plaintext
**Context:** The key is a shared secret. It must not be recoverable from the database.
**Decision:** Server receives the raw key string, hashes with bcrypt (cost 10) before storing. Owner receives the raw key in the creation response — stored client-side in localStorage alongside the owner token. Never retrievable from the server.
**Consequence:** If a creator loses their key, it cannot be recovered. Documented behaviour, not a bug.

### ADR-09 — Access attempts log as first-class feature
**Context:** The spatial gate is the interesting part of the portfolio project. Making it invisible wastes the demo opportunity.
**Decision:** Every read attempt is logged with coordinates, outcome, and reason (`outside_zone`, `wrong_key`, `expired`, `granted`). Owner view displays attempt count and a mini-map of attempt coordinates (green = granted, red = denied).
**Consequence:** Adds one INSERT per read attempt. Negligible at this scale. Makes the PostGIS mechanic visible and demonstrable.

### ADR-10 — No accounts
**Context:** Accounts add friction and infrastructure (auth, sessions, email).
**Decision:** Creator receives a UUID `owner_token` at creation time. Stored in localStorage. Passed as a header for delete and owner-view routes. No registration, no login.
**Consequence:** If the user clears localStorage, they lose owner access to their drops. Documented limitation.

---

## Data model

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE drops (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        UNIQUE NOT NULL,
  title           text,
  content         text        NOT NULL,
  content_type    text        NOT NULL DEFAULT 'text/plain',
  drop_zone       geography(Polygon, 4326) NOT NULL,
  radius_m        float       NOT NULL DEFAULT 100,
  key_hash        text,                          -- nullable; bcrypt hash of key
  owner_token     text        NOT NULL,          -- UUID, returned once at creation
  created_at      timestamptz NOT NULL DEFAULT now(),
  hard_expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  view_expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  view_count      int         NOT NULL DEFAULT 0
);

CREATE TABLE access_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id      uuid        NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  lat          float       NOT NULL,
  lng          float       NOT NULL,
  granted      boolean     NOT NULL,
  reason       text,       -- 'outside_zone' | 'wrong_key' | 'expired' | 'granted'
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX drops_zone_gist   ON drops USING GIST (drop_zone);
CREATE INDEX drops_slug_idx    ON drops (slug);
CREATE INDEX drops_expiry_idx  ON drops (hard_expires_at);
CREATE INDEX attempts_drop_idx ON access_attempts (drop_id);
```

---

## API surface

| Method   | Route                      | Description                                      |
|----------|----------------------------|--------------------------------------------------|
| `POST`   | `/drops`                   | Create a drop                                    |
| `GET`    | `/drops/nearby`            | List pins near a coordinate (no content leaked)  |
| `GET`    | `/drops/:slug`             | Read a drop — spatial + key gate                 |
| `GET`    | `/drops/:slug/attempts`    | Attempt log (owner only)                         |
| `DELETE` | `/drops/:slug`             | Delete a drop early (owner only)                 |

### POST /drops

Request body:
```json
{
  "title": "Festival welcome message",
  "content": "You made it. Here's the backstage wifi: ...",
  "lat": 52.2297,
  "lng": 21.0122,
  "radius_m": 200,
  "key": "sunflower",
  "hard_expires_at": "2026-07-01T23:00:00Z"
}
```

Response `201`:
```json
{
  "slug": "brave-falcon-42",
  "owner_token": "uuid-v4",
  "expires_at": "2026-07-01T23:00:00Z"
}
```

### GET /drops/nearby?lat=&lng=&radius_m=

Returns pin locations only. No content, no slugs, no key hint. Just coordinates and a `has_key` boolean so the UI can show a lock icon variant.

```json
{
  "drops": [
    { "lat": 52.23, "lng": 21.01, "has_key": true, "expires_at": "..." }
  ]
}
```

Slugs are intentionally withheld — you can't deep-link to a drop without being there.

### GET /drops/:slug?lat=&lng=&key=

Gate order:
1. Drop exists and is not expired → else 404 / 410
2. `ST_Within(point, drop_zone)` → else 403 `outside_zone`
3. `key_hash IS NULL OR bcrypt.compare(key, key_hash)` → else 403 `wrong_key`
4. Log attempt as `granted`, increment `view_count`, reset `view_expires_at`
5. Return content

### GET /drops/:slug/attempts
Header: `x-owner-token: <uuid>`
Returns full attempt log with coordinates and reasons.

### DELETE /drops/:slug
Header: `x-owner-token: <uuid>`
Hard deletes the drop and all attempts (CASCADE).

---

## Frontend screens

### Map (home)
Full-screen Leaflet map. On load requests geolocation. Polls `GET /drops/nearby` every 30s. Renders pins — locked icon if `has_key`, unlocked-outline if no key. Tap a pin → bottom sheet slides up.

### Drop bottom sheet
Shows title (or "Unnamed drop"). If `has_key`: key input field. "Unlock" button calls `GET /drops/:slug` with current coords + key. On `outside_zone`: "You're not close enough." On `wrong_key`: "Incorrect key." On success: content revealed in same sheet.

### Create drop (FAB → side panel)
- Click map or use current location to place pin
- Radius slider (10m–1000m) — live circle preview on map
- Title (optional), Content (required)
- Key (optional) — placeholder: "e.g. sunflower · share this with people at the location"
- Expiry selector (1h / 6h / 24h / 7 days)
- Submit → receives slug + owner_token → stored in localStorage

### Owner view
Accessed via `geolock.app/owner/:slug` with owner_token in localStorage. Shows content, stats (view count, attempt count), attempt mini-map, delete button.

---

## Project structure

```
geolock/
  packages/
    server/
      src/
        routes/
          drops.create.ts
          drops.read.ts
          drops.nearby.ts
          drops.attempts.ts
          drops.delete.ts
        db/
          schema.sql
          client.ts
        lib/
          slug.ts
          expiry.ts
          spatial.ts
          key.ts
        app.ts
        server.ts
      package.json
      tsconfig.json
    web/
      src/
        components/
          Map.tsx
          DropPin.tsx
          CreatePanel.tsx
          DropSheet.tsx
          OwnerView.tsx
          AttemptMap.tsx
        hooks/
          useGeolocation.ts
          useNearbyDrops.ts
          useOwnerDrops.ts
        lib/
          api.ts
          storage.ts
        App.tsx
        main.tsx
      index.html
      package.json
      tsconfig.json
      vite.config.ts
  pnpm-workspace.yaml
  package.json
  README.md
```

---

## Implementation tickets

See `/tickets/` directory. Execute sequentially — each ticket has a clear input/output contract.

T-01 Repo + workspace init
T-02 PostgreSQL connection + schema
T-03 POST /drops route
T-04 GET /drops/:slug route (spatial + key gate)
T-05 GET /drops/nearby route
T-06 GET /drops/:slug/attempts route
T-07 DELETE /drops/:slug route
T-08 Expiry cleanup cron
T-09 React app scaffold + Leaflet map
T-10 useGeolocation + useNearbyDrops hooks
T-11 Drop pins + bottom sheet
T-12 Create panel (map click + circle preview + submit)
T-13 Key input + gate error states
T-14 Owner view + attempt mini-map
T-15 nginx config + VPS deploy

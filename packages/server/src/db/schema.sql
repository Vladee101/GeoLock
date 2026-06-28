CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS drops (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        UNIQUE NOT NULL,
  title           text,
  content         text        NOT NULL,
  content_type    text        NOT NULL DEFAULT 'text/plain',
  drop_zone       geography(Polygon, 4326) NOT NULL,
  radius_m        float       NOT NULL DEFAULT 100,
  key_hash        text,
  owner_token     text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  hard_expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  view_expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  view_count      int         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS access_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id      uuid        NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  lat          float       NOT NULL,
  lng          float       NOT NULL,
  granted      boolean     NOT NULL,
  reason       text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drops_zone_gist    ON drops USING GIST (drop_zone);
CREATE INDEX IF NOT EXISTS drops_slug_idx     ON drops (slug);
CREATE INDEX IF NOT EXISTS drops_expiry_idx   ON drops (hard_expires_at);
CREATE INDEX IF NOT EXISTS attempts_drop_idx  ON access_attempts (drop_id);

-- Fecha Libre: salones, dueños, sesiones y días ocupados

CREATE TABLE venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,           -- la parte del link: /s/<slug>
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  capacity TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🎉',
  color1 TEXT NOT NULL DEFAULT '#3f6b5a',
  color2 TEXT NOT NULL DEFAULT '#f2b544',
  logo TEXT,                            -- imagen chica guardada como data URL
  slots TEXT NOT NULL DEFAULT '[{"id":"s1","label":"Mediodía","hours":"12 a 17 hs"},{"id":"s2","label":"Noche","hours":"20 a 4 hs"}]',
  ready INTEGER NOT NULL DEFAULT 0,     -- 0 = en preparación (solo lo ven el dueño y la admin)
  is_demo INTEGER NOT NULL DEFAULT 0,
  demo_reset_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER,                      -- NULL para la admin
  role TEXT NOT NULL,                   -- 'owner' o 'admin'
  expires_at INTEGER NOT NULL
);

-- Un turno ocupado de un día. Si no hay fila, está libre.
CREATE TABLE blocks (
  venue_id INTEGER NOT NULL,
  date TEXT NOT NULL,                   -- AAAA-MM-DD
  slot TEXT NOT NULL,                   -- id del turno (s1, s2...)
  note TEXT NOT NULL DEFAULT '',        -- nota privada del dueño
  PRIMARY KEY (venue_id, date, slot)
);

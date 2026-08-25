BEGIN;

CREATE TABLE IF NOT EXISTS sely_daily_content (
  content_date date NOT NULL,
  game_id varchar(16) NOT NULL CHECK (game_id IN ('echo', 'knot', 'cut', 'shadow', 'marker')),
  seed integer NOT NULL,
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  ruleset_version varchar(12) NOT NULL,
  payload_codec varchar(24) NOT NULL CHECK (payload_codec IN ('json', 'deflate-base64url')),
  payload text NOT NULL,
  checksum varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_date, game_id)
);

CREATE INDEX IF NOT EXISTS sely_daily_content_date_idx ON sely_daily_content (content_date DESC);

COMMIT;

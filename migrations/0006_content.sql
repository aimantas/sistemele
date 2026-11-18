-- Content: website pages (/<slug>) and blog posts (/blog/<slug>), written in Markdown.
-- An entry is public when status = 'published' and published_at <= now, so a
-- future published_at schedules it without a background job.

CREATE TABLE content_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('page', 'post')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  -- Pages only: position in the public site menu; NULL keeps the page out of it.
  menu_order INTEGER CHECK (menu_order IS NULL OR menu_order BETWEEN 1 AND 99),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE UNIQUE INDEX content_entries_slug_idx ON content_entries(type, slug);
CREATE INDEX content_entries_public_idx ON content_entries(type, status, published_at);
CREATE INDEX content_entries_updated_idx ON content_entries(updated_at);

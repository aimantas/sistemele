-- CRM: contacts (people and companies), deals on a pipeline, activity timeline.

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'company' CHECK (kind IN ('person', 'company')),
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  phone TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  company_code TEXT NOT NULL DEFAULT '',
  vat_code TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at TEXT
);
CREATE INDEX contacts_name_idx ON contacts(name COLLATE NOCASE);
CREATE INDEX contacts_email_idx ON contacts(email);
CREATE INDEX contacts_created_idx ON contacts(created_at);

CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  value_cents INTEGER NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'won', 'lost')),
  position REAL NOT NULL DEFAULT 0,
  expected_close_date TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  closed_at TEXT
);
CREATE INDEX deals_stage_idx ON deals(stage, position);
CREATE INDEX deals_contact_idx ON deals(contact_id);

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('note', 'call', 'email', 'meeting', 'task', 'system')),
  body TEXT NOT NULL,
  due_at TEXT,
  done_at TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX activities_contact_idx ON activities(contact_id, created_at);
CREATE INDEX activities_deal_idx ON activities(deal_id, created_at);
CREATE INDEX activities_open_tasks_idx ON activities(kind, done_at, due_at);

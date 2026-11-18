-- CRM: configurable pipeline stages, a leads inbox, deal owners and lost reasons.
--
-- Deals keep their `stage` column, now free text that points at
-- pipeline_stages.id (the fixed CHECK list from 0002 is gone). Website
-- requests become leads; a lead converts into a contact and a deal.

CREATE TABLE pipeline_stages (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'open' CHECK (kind IN ('open', 'won', 'lost')),
  probability_bps INTEGER NOT NULL DEFAULT 0 CHECK (probability_bps BETWEEN 0 AND 10000),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO pipeline_stages (id, label, kind, probability_bps, position) VALUES
 ('qualified', 'Qualified', 'open', 2000, 1),
 ('proposal', 'Proposal', 'open', 5000, 2),
 ('negotiation', 'Negotiation', 'open', 8000, 3),
 ('won', 'Won', 'won', 10000, 100),
 ('lost', 'Lost', 'lost', 0, 101);

-- Replace the CHECK-constrained stage column. Deals in the retired "lead"
-- stage move to "qualified"; new requests arrive in the leads inbox instead.
ALTER TABLE deals ADD COLUMN stage_id TEXT NOT NULL DEFAULT 'qualified';
UPDATE deals SET stage_id = CASE WHEN stage = 'lead' THEN 'qualified' ELSE stage END;
DROP INDEX deals_stage_idx;
ALTER TABLE deals DROP COLUMN stage;
ALTER TABLE deals RENAME COLUMN stage_id TO stage;
CREATE INDEX deals_stage_idx ON deals(stage, position);
ALTER TABLE deals ADD COLUMN lost_reason TEXT NOT NULL DEFAULT '';
CREATE INDEX deals_owner_idx ON deals(owner_id);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'disqualified', 'converted')),
  value_cents INTEGER NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  follow_up_on TEXT,
  disqualify_reason TEXT NOT NULL DEFAULT '',
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
  converted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX leads_status_idx ON leads(status, created_at);
CREATE INDEX leads_owner_idx ON leads(owner_id, status);
CREATE INDEX leads_email_idx ON leads(email);
CREATE INDEX leads_follow_up_idx ON leads(status, follow_up_on);

ALTER TABLE activities ADD COLUMN lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE;
CREATE INDEX activities_lead_idx ON activities(lead_id, created_at);

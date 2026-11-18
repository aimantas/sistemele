-- Quotes: priced offers a customer can open and accept through a private link.

CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
  issue_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  vat_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL DEFAULT '',
  public_token_hash TEXT UNIQUE,
  sent_at TEXT,
  responded_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX quotes_status_idx ON quotes(status, issue_date);
CREATE INDEX quotes_contact_idx ON quotes(contact_id);

CREATE TABLE quote_lines (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  vat_rate_bps INTEGER NOT NULL CHECK (vat_rate_bps BETWEEN 0 AND 10000),
  discount_bps INTEGER NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  subtotal_cents INTEGER NOT NULL
);
CREATE INDEX quote_lines_quote_idx ON quote_lines(quote_id, position);

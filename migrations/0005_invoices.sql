-- Invoices: numbered on issue, immutable once issued (void, never edit),
-- seller and buyer details snapshotted so later edits never rewrite history.

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  issue_date TEXT,
  due_date TEXT,
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  vat_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  seller TEXT,
  buyer TEXT,
  notes TEXT NOT NULL DEFAULT '',
  public_token_hash TEXT UNIQUE,
  issued_at TEXT,
  paid_at TEXT,
  voided_at TEXT,
  void_reason TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX invoices_status_idx ON invoices(status, due_date);
CREATE INDEX invoices_contact_idx ON invoices(contact_id);
CREATE UNIQUE INDEX invoices_quote_idx ON invoices(quote_id) WHERE quote_id IS NOT NULL AND status <> 'void';

CREATE TABLE invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
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
CREATE INDEX invoice_lines_invoice_idx ON invoice_lines(invoice_id, position);

CREATE TABLE invoice_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_on TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer', 'card', 'cash', 'other')),
  reference TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX invoice_payments_invoice_idx ON invoice_payments(invoice_id);

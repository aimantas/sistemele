-- Catalog and stock: products/services and an append-only stock ledger.
-- products.stock_on_hand is a cache of SUM(stock_movements.quantity); it is
-- only ever changed in the same batch that inserts the movement.

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'product' CHECK (kind IN ('product', 'service')),
  unit TEXT NOT NULL DEFAULT 'pcs',
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
  vat_rate_bps INTEGER NOT NULL DEFAULT 2100 CHECK (vat_rate_bps BETWEEN 0 AND 10000),
  track_stock INTEGER NOT NULL DEFAULT 1 CHECK (track_stock IN (0, 1)),
  stock_on_hand REAL NOT NULL DEFAULT 0,
  reorder_point REAL NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX products_name_idx ON products(name COLLATE NOCASE);
CREATE INDEX products_public_idx ON products(is_public, status);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity REAL NOT NULL CHECK (quantity <> 0),
  reason TEXT NOT NULL CHECK (reason IN ('receipt', 'sale', 'return', 'adjustment', 'count')),
  reference_type TEXT,
  reference_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX stock_movements_product_idx ON stock_movements(product_id, created_at);
CREATE UNIQUE INDEX stock_movements_reference_idx ON stock_movements(product_id, reference_type, reference_id) WHERE reference_type IS NOT NULL AND reason = 'sale';

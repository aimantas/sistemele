-- Demo invoices (fictional; local development only). Requires seed/01_core.sql,
-- seed/02_crm.sql and seed/04_quotes.sql. Totals follow src/shared/money.ts:
-- each line's net is rounded to cents, VAT is rounded once per rate group.
-- Seller and buyer columns hold the snapshots taken on issue (the business
-- profile in 01_core.sql and the contacts in 02_crm.sql). Customer links are
-- created on send, so public_token_hash stays NULL here.

INSERT OR IGNORE INTO invoices (id, number, contact_id, quote_id, status, issue_date, due_date, currency, subtotal_cents, vat_cents, total_cents, paid_cents, seller, buyer, notes, issued_at, paid_at, created_at, updated_at) VALUES
 -- Issued and overdue: due 16 days ago, nothing paid. 102000 + 22000 = 124000 net; 21% VAT = 26040.
 ('inv_demo_1', 'INV-' || strftime('%Y','now') || '-0001', 'ct_demo_baltic', NULL, 'issued', date('now','-30 days'), date('now','-16 days'), 'EUR', 124000, 26040, 150040, 0,
  '{"name":"Northwind Workshop UAB","companyCode":"300000001","vatCode":"LT100000000017","address":"Example g. 1, LT-01100 Vilnius","email":"sales@northwind.example","phone":"+370 600 00000","bank":{"name":"Example Bank","iban":"LT12 1000 0111 0100 1000"},"footer":"Thank you for your business."}',
  '{"name":"Baltic Build UAB","companyCode":"301111111","vatCode":"LT111111111","address":"Statybininkų g. 5, LT-44100 Kaunas, LT","email":"orders@balticbuild.example","phone":"+370 611 11111"}',
  '', strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-31 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),
 -- Paid in full: invoiced from the accepted quote Q-…-0002 (same lines and totals).
 ('inv_demo_2', 'INV-' || strftime('%Y','now') || '-0002', 'ct_demo_greenhouse', 'qt_demo_2', 'paid', date('now','-7 days'), date('now','+7 days'), 'EUR', 382400, 80304, 462704, 462704,
  '{"name":"Northwind Workshop UAB","companyCode":"300000001","vatCode":"LT100000000017","address":"Example g. 1, LT-01100 Vilnius","email":"sales@northwind.example","phone":"+370 600 00000","bank":{"name":"Example Bank","iban":"LT12 1000 0111 0100 1000"},"footer":"Thank you for your business."}',
  '{"name":"Greenhouse Farms","companyCode":"302222222","vatCode":"LT222222222","address":"Ūkio g. 12, LT-35100 Panevėžys, LT","email":"hello@greenhouse.example","phone":"+370 633 33333"}',
  'Beams are cut to length and drilled for the anchor bolts.', strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 -- Issued, not yet due. 4000 net; 21% VAT = 840.
 ('inv_demo_3', 'INV-' || strftime('%Y','now') || '-0003', 'ct_demo_ona', NULL, 'issued', date('now','-3 days'), date('now','+11 days'), 'EUR', 4000, 840, 4840, 0,
  '{"name":"Northwind Workshop UAB","companyCode":"300000001","vatCode":"LT100000000017","address":"Example g. 1, LT-01100 Vilnius","email":"sales@northwind.example","phone":"+370 600 00000","bank":{"name":"Example Bank","iban":"LT12 1000 0111 0100 1000"},"footer":"Thank you for your business."}',
  '{"name":"Ona Petraitė","companyCode":"","vatCode":"","address":"Vilnius, LT","email":"ona@example.com","phone":"+370 622 22222"}',
  '', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
 -- Draft: no number, no snapshots, still editable. 75600 + 22000 = 97600 net; 21% VAT = 20496.
 ('inv_demo_4', NULL, 'ct_demo_baltic', NULL, 'draft', NULL, NULL, 'EUR', 97600, 20496, 118096, 0,
  NULL, NULL, 'Replacement frames for aisle 3.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'));

INSERT OR IGNORE INTO invoice_lines (id, invoice_id, position, product_id, description, quantity, unit, unit_price_cents, vat_rate_bps, discount_bps, subtotal_cents) VALUES
 ('il_demo_1_1', 'inv_demo_1', 1, NULL, 'Steel shelving bracket', 120, 'pcs', 850, 2100, 0, 102000),
 ('il_demo_1_2', 'inv_demo_1', 2, NULL, 'Delivery to Kaunas', 1, 'trip', 22000, 2100, 0, 22000),
 ('il_demo_2_1', 'inv_demo_2', 1, NULL, 'Galvanised support beam HEA 160, 6 m', 14, 'pcs', 21500, 2100, 0, 301000),
 ('il_demo_2_2', 'inv_demo_2', 2, NULL, 'Anchor bolt set M16', 56, 'set', 650, 2100, 0, 36400),
 ('il_demo_2_3', 'inv_demo_2', 3, NULL, 'Structural calculation', 1, 'pcs', 45000, 2100, 0, 45000),
 ('il_demo_3_1', 'inv_demo_3', 1, NULL, 'Site measurement visit', 1, 'pcs', 4000, 2100, 0, 4000),
 ('il_demo_4_1', 'inv_demo_4', 1, NULL, 'Pallet racking upright frame, 3000 mm', 4, 'pcs', 18900, 2100, 0, 75600),
 ('il_demo_4_2', 'inv_demo_4', 2, NULL, 'Delivery to Kaunas', 1, 'trip', 22000, 2100, 0, 22000);

INSERT OR IGNORE INTO invoice_payments (id, invoice_id, amount_cents, paid_on, method, reference, created_at) VALUES
 ('pay_demo_1', 'inv_demo_2', 462704, date('now','-2 days'), 'bank_transfer', 'INV-' || strftime('%Y','now') || '-0002', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'));

-- The timeline entries the CRM module writes when invoices are issued and paid.
INSERT OR IGNORE INTO activities (id, contact_id, deal_id, kind, body, created_at) VALUES
 ('act_demo_i1', 'ct_demo_baltic', NULL, 'system', 'Invoice INV-' || strftime('%Y','now') || '-0001 issued (€1,500.40).', strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),
 ('act_demo_i2', 'ct_demo_greenhouse', NULL, 'system', 'Invoice INV-' || strftime('%Y','now') || '-0002 issued (€4,627.04).', strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')),
 ('act_demo_i3', 'ct_demo_greenhouse', NULL, 'system', 'Invoice INV-' || strftime('%Y','now') || '-0002 paid.', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 ('act_demo_i4', 'ct_demo_ona', NULL, 'system', 'Invoice INV-' || strftime('%Y','now') || '-0003 issued (€48.40).', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'));

-- Continue numbering after the demo invoices without ever moving the series back.
INSERT INTO sequences (name, value) VALUES ('INV-' || strftime('%Y','now'), 3)
  ON CONFLICT(name) DO UPDATE SET value = MAX(sequences.value, excluded.value);

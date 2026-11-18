-- Demo quotes (fictional; local development only). Requires seed/02_crm.sql.
-- Totals follow src/shared/money.ts: each line's net is rounded to cents,
-- VAT is rounded once per rate group. Customer links are created on send,
-- so public_token_hash stays NULL here.

INSERT OR IGNORE INTO quotes (id, number, contact_id, deal_id, status, issue_date, valid_until, currency, subtotal_cents, vat_cents, total_cents, notes, terms, sent_at, responded_at, created_at, updated_at) VALUES
 -- Sent, awaiting an answer. 756000 + 646000 + 216000 + 22000 = 1640000 net; 21% VAT = 344400.
 ('qt_demo_1', 'Q-' || strftime('%Y','now') || '-0001', 'ct_demo_baltic', 'dl_demo_1', 'sent', date('now','-4 days'), date('now','+26 days'), 'EUR', 1640000, 344400, 1984400,
  'Delivery and installation within 3 weeks of acceptance.', '30% advance on acceptance, balance within 14 days of installation.',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 -- Accepted online; the deal was won the same day. 301000 + 36400 + 45000 = 382400 net; 21% VAT = 80304.
 ('qt_demo_2', 'Q-' || strftime('%Y','now') || '-0002', 'ct_demo_greenhouse', 'dl_demo_4', 'accepted', date('now','-14 days'), date('now','+16 days'), 'EUR', 382400, 80304, 462704,
  'Beams are cut to length and drilled for the anchor bolts.', 'Payment within 14 days of delivery.',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days')),
 -- Draft export quote at 0% VAT. 852000 + (109500 - 10%) 98550 + 18000 = 968550 net.
 ('qt_demo_3', 'Q-' || strftime('%Y','now') || '-0003', 'ct_demo_nordic', 'dl_demo_2', 'draft', date('now'), date('now','+30 days'), 'EUR', 968550, 0, 968550,
  'Delivery EXW Vilnius. VAT 0%: goods exported outside the EU.', '50% advance, balance before loading.',
  NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'));

INSERT OR IGNORE INTO quote_lines (id, quote_id, position, product_id, description, quantity, unit, unit_price_cents, vat_rate_bps, discount_bps, subtotal_cents) VALUES
 ('ql_demo_1_1', 'qt_demo_1', 1, NULL, 'Pallet racking upright frame, 3000 mm', 40, 'pcs', 18900, 2100, 0, 756000),
 ('ql_demo_1_2', 'qt_demo_1', 2, NULL, 'Pallet racking beam pair, 2700 mm', 160, 'pcs', 4250, 2100, 500, 646000),
 ('ql_demo_1_3', 'qt_demo_1', 3, NULL, 'Installation', 48, 'h', 4500, 2100, 0, 216000),
 ('ql_demo_1_4', 'qt_demo_1', 4, NULL, 'Delivery to Kaunas', 1, 'trip', 22000, 2100, 0, 22000),
 ('ql_demo_2_1', 'qt_demo_2', 1, NULL, 'Galvanised support beam HEA 160, 6 m', 14, 'pcs', 21500, 2100, 0, 301000),
 ('ql_demo_2_2', 'qt_demo_2', 2, NULL, 'Anchor bolt set M16', 56, 'set', 650, 2100, 0, 36400),
 ('ql_demo_2_3', 'qt_demo_2', 3, NULL, 'Structural calculation', 1, 'pcs', 45000, 2100, 0, 45000),
 ('ql_demo_3_1', 'qt_demo_3', 1, NULL, 'Welded steel cabin frame, type A', 3, 'pcs', 284000, 0, 0, 852000),
 ('ql_demo_3_2', 'qt_demo_3', 2, NULL, 'Hot-dip galvanising', 3, 'pcs', 36500, 0, 1000, 98550),
 ('ql_demo_3_3', 'qt_demo_3', 3, NULL, 'Export packing and loading', 1, 'pcs', 18000, 0, 0, 18000);

-- The timeline entries the CRM module writes when quotes are sent and answered.
INSERT OR IGNORE INTO activities (id, contact_id, deal_id, kind, body, created_at) VALUES
 ('act_demo_q1', 'ct_demo_baltic', 'dl_demo_1', 'system', 'Quote Q-' || strftime('%Y','now') || '-0001 sent.', strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('act_demo_q2', 'ct_demo_greenhouse', 'dl_demo_4', 'system', 'Quote Q-' || strftime('%Y','now') || '-0002 sent.', strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days')),
 ('act_demo_q3', 'ct_demo_greenhouse', 'dl_demo_4', 'system', 'Quote Q-' || strftime('%Y','now') || '-0002 accepted (€4,627.04).', strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'));

-- Continue numbering after the demo quotes without ever moving the series back.
INSERT INTO sequences (name, value) VALUES ('Q-' || strftime('%Y','now'), 3)
  ON CONFLICT(name) DO UPDATE SET value = MAX(sequences.value, excluded.value);

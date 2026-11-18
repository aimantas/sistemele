-- Demo CRM data (fictional companies and people; local development and the public demo only).

-- Pipeline stages. Migration 0007 creates the same defaults; they are repeated
-- here because the demo reset empties every table before loading the seed.
INSERT OR IGNORE INTO pipeline_stages (id, label, kind, probability_bps, position) VALUES
 ('qualified', 'Qualified', 'open', 2000, 1),
 ('proposal', 'Proposal', 'open', 5000, 2),
 ('negotiation', 'Negotiation', 'open', 8000, 3),
 ('won', 'Won', 'won', 10000, 100),
 ('lost', 'Lost', 'lost', 0, 101);

INSERT OR IGNORE INTO contacts (id, kind, name, email, phone, company_code, vat_code, address, city, postal_code, country, tags, source, created_at, updated_at) VALUES
 ('ct_demo_baltic', 'company', 'Baltic Build UAB', 'orders@balticbuild.example', '+370 611 11111', '301111111', 'LT111111111', 'Statybininkų g. 5', 'Kaunas', 'LT-44100', 'LT', '["wholesale","vip"]', 'manual', strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
 ('ct_demo_nordic', 'company', 'Nordic Frames AS', 'post@nordicframes.example', '+47 400 00000', '', 'NO999999999', 'Havnegata 2', 'Oslo', '0150', 'NO', '["export"]', 'manual', strftime('%Y-%m-%dT%H:%M:%fZ','now','-25 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
 ('ct_demo_ona', 'person', 'Ona Petraitė', 'ona@example.com', '+370 622 22222', '', '', '', 'Vilnius', '', 'LT', '["website"]', 'website', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('ct_demo_greenhouse', 'company', 'Greenhouse Farms', 'hello@greenhouse.example', '+370 633 33333', '302222222', 'LT222222222', 'Ūkio g. 12', 'Panevėžys', 'LT-35100', 'LT', '[]', 'manual', strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'));

INSERT OR IGNORE INTO deals (id, contact_id, title, value_cents, stage, position, expected_close_date, lost_reason, created_at, updated_at, closed_at) VALUES
 ('dl_demo_1', 'ct_demo_baltic', 'Warehouse shelving, phase 2', 1840000, 'proposal', 1, date('now','+10 days'), '', strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), NULL),
 ('dl_demo_2', 'ct_demo_nordic', 'Steel frames for 3 cabins', 960000, 'negotiation', 1, date('now','+30 days'), '', strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), NULL),
 ('dl_demo_3', 'ct_demo_ona', 'Garden gate', 85000, 'qualified', 1, NULL, '', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), NULL),
 ('dl_demo_4', 'ct_demo_greenhouse', 'Greenhouse support beams', 420000, 'won', 1, NULL, '', strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days')),
 ('dl_demo_5', 'ct_demo_baltic', 'Loading ramp repair', 120000, 'lost', 1, NULL, 'Chose a supplier closer to the site.', strftime('%Y-%m-%dT%H:%M:%fZ','now','-50 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-35 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-35 days'));

-- Leads in every status, so each filter and the dashboard card show something.
INSERT OR IGNORE INTO leads (id, name, email, phone, company, message, source, status, value_cents, follow_up_on, disqualify_reason, contact_id, deal_id, converted_at, created_at, updated_at) VALUES
 ('ld_demo_lukas', 'Lukas Kazlauskas', 'lukas@riverside.example', '+370 644 44444', 'Riverside Café', 'Six steel bar stools and two railings for a terrace. Opening in spring.', 'website', 'new', 0, NULL, '', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
 ('ld_demo_eva', 'Eva Lind', 'eva@lindarchitects.example', '', 'Lind Architects', 'Steel staircase for a private house; drawings ready.', 'referral', 'contacted', 650000, date('now','-1 days'), '', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('ld_demo_tomas', 'Tomas Jankauskas', 'tomas@agrotech.example', '+370 655 55555', 'Agrotech UAB', 'Brackets for 40 irrigation lines, repeat order every season.', 'event', 'qualified', 300000, date('now','+3 days'), '', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 ('ld_demo_spam', 'Best SEO Offers', 'offers@seo.example', '', '', 'We can rank your website first on every search engine.', 'website', 'disqualified', 0, NULL, 'Spam', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 days')),
 ('ld_demo_ona', 'Ona Petraitė', 'ona@example.com', '+370 622 22222', '', 'A 3 m garden gate, galvanised, with a lock.', 'website', 'converted', 85000, NULL, '', 'ct_demo_ona', 'dl_demo_3', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'));

INSERT OR IGNORE INTO activities (id, contact_id, deal_id, lead_id, kind, body, due_at, done_at, created_at) VALUES
 ('act_demo_1', 'ct_demo_baltic', 'dl_demo_1', NULL, 'call', 'Discussed phase 2 layout. They want delivery before the end of the month.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
 ('act_demo_2', 'ct_demo_baltic', 'dl_demo_1', NULL, 'task', 'Follow up on the shelving quote', date('now','+1 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 ('act_demo_3', 'ct_demo_ona', 'dl_demo_3', 'ld_demo_ona', 'call', 'Confirmed the gate width: 3 m, opening inwards.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('act_demo_4', 'ct_demo_ona', 'dl_demo_3', NULL, 'task', 'Send Ona the gate quote', date('now','-1 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
 ('act_demo_5', 'ct_demo_nordic', 'dl_demo_2', NULL, 'email', 'Sent drawings for review.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
 ('act_demo_6', NULL, NULL, 'ld_demo_eva', 'email', 'Asked for the staircase drawings and the delivery address.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('act_demo_7', NULL, NULL, 'ld_demo_eva', 'system', 'Status: New → Contacted.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('act_demo_8', NULL, NULL, 'ld_demo_tomas', 'meeting', 'Met at the farm fair. Needs a price per 100 brackets.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days')),
 ('act_demo_9', NULL, NULL, 'ld_demo_tomas', 'task', 'Price 100 brackets for Agrotech', date('now','+3 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 ('act_demo_10', 'ct_demo_ona', 'dl_demo_3', 'ld_demo_ona', 'system', 'Converted from lead Ona Petraitė into deal Garden gate.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'));

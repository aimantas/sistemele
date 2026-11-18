-- Demo CRM data (fictional companies; local development only).
INSERT OR IGNORE INTO contacts (id, kind, name, email, phone, company_code, vat_code, address, city, postal_code, country, tags, source, created_at, updated_at) VALUES
 ('ct_demo_baltic', 'company', 'Baltic Build UAB', 'orders@balticbuild.example', '+370 611 11111', '301111111', 'LT111111111', 'Statybininkų g. 5', 'Kaunas', 'LT-44100', 'LT', '["wholesale","vip"]', 'manual', strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
 ('ct_demo_nordic', 'company', 'Nordic Frames AS', 'post@nordicframes.example', '+47 400 00000', '', 'NO999999999', 'Havnegata 2', 'Oslo', '0150', 'NO', '["export"]', 'manual', strftime('%Y-%m-%dT%H:%M:%fZ','now','-25 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
 ('ct_demo_ona', 'person', 'Ona Petraitė', 'ona@example.com', '+370 622 22222', '', '', '', 'Vilnius', '', 'LT', '["website"]', 'website', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('ct_demo_greenhouse', 'company', 'Greenhouse Farms', 'hello@greenhouse.example', '+370 633 33333', '302222222', 'LT222222222', 'Ūkio g. 12', 'Panevėžys', 'LT-35100', 'LT', '[]', 'manual', strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'));

INSERT OR IGNORE INTO deals (id, contact_id, title, value_cents, stage, position, expected_close_date, created_at, updated_at, closed_at) VALUES
 ('dl_demo_1', 'ct_demo_baltic', 'Warehouse shelving, phase 2', 1840000, 'proposal', 1, date('now','+10 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), NULL),
 ('dl_demo_2', 'ct_demo_nordic', 'Steel frames for 3 cabins', 960000, 'qualified', 1, date('now','+30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), NULL),
 ('dl_demo_3', 'ct_demo_ona', 'Website request: garden gate', 85000, 'lead', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), NULL),
 ('dl_demo_4', 'ct_demo_greenhouse', 'Greenhouse support beams', 420000, 'won', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days')),
 ('dl_demo_5', 'ct_demo_baltic', 'Loading ramp repair', 120000, 'lost', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-50 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-35 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-35 days'));

INSERT OR IGNORE INTO activities (id, contact_id, deal_id, kind, body, due_at, done_at, created_at) VALUES
 ('act_demo_1', 'ct_demo_baltic', 'dl_demo_1', 'call', 'Discussed phase 2 layout. They want delivery before the end of the month.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
 ('act_demo_2', 'ct_demo_baltic', 'dl_demo_1', 'task', 'Follow up on the shelving quote', date('now','+1 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 ('act_demo_3', 'ct_demo_ona', 'dl_demo_3', 'note', 'Website request: a 3 m garden gate, galvanised, with a lock. Wants a price this week.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('act_demo_4', 'ct_demo_ona', 'dl_demo_3', 'task', 'Call Ona to confirm gate width', date('now','-1 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
 ('act_demo_5', 'ct_demo_nordic', 'dl_demo_2', 'email', 'Sent drawings for review.', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'));

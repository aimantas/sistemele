-- Demo catalog for a fictional metal workshop (local development only).
-- Prices are net cents; VAT 21%. stock_on_hand equals the sum of each
-- product's stock_movements below. Rebar and the garden gate start at or
-- below their reorder point so the low-stock widget has something to show.
INSERT OR IGNORE INTO products (id, sku, slug, name, description, kind, unit, price_cents, cost_cents, vat_rate_bps, track_stock, stock_on_hand, reorder_point, is_public, image_url, status, created_at, updated_at) VALUES
 ('prd_demo_mesh', 'MESH-2X1', 'welded-mesh-panel-2x1-m', 'Welded mesh panel 2 × 1 m', 'Welded steel mesh panel for fences, cages and reinforcement.

Wire 4 mm, mesh 100 × 100 mm, black steel.', 'product', 'pcs', 3800, 2400, 2100, 1, 42, 10, 1, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('prd_demo_rebar', 'RB12-6M', 'rebar-b500b-12-mm-6-m', 'Rebar B500B Ø12 mm, 6 m', 'Ribbed reinforcing bar, 12 mm diameter, cut to 6 m lengths.', 'product', 'pcs', 890, 610, 2100, 1, 6, 20, 1, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
 ('prd_demo_gate', 'GATE-1000', 'galvanised-garden-gate-1-m', 'Galvanised garden gate, 1 m', 'Single-leaf garden gate, 1 m wide and 1.2 m high, hot-dip galvanised, with hinges and a latch.', 'product', 'pcs', 24500, 15800, 2100, 1, 1, 2, 1, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-50 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days')),
 ('prd_demo_tube', 'ST40-6M', 'square-steel-tube-40x40x2-mm-6-m', 'Square steel tube 40 × 40 × 2 mm, 6 m', 'Square hollow section for frames, posts and railings. Sold in 6 m lengths.', 'product', 'pcs', 2150, 1500, 2100, 1, 35, 10, 1, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-18 days')),
 ('prd_demo_bracket', 'BRK-40', 'wall-bracket-4-mm-steel', 'Wall bracket, 4 mm steel', 'Angle bracket for shelves and fixings, with two mounting holes.', 'product', 'pcs', 450, 180, 2100, 1, 120, 30, 0, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
 ('prd_demo_primer', 'PRM-1L', 'anti-rust-primer-1-l', 'Anti-rust primer, 1 l', 'Primer for bare steel before painting.', 'product', 'pcs', 1290, 790, 2100, 1, 18, 6, 0, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days')),
 ('prd_demo_welding', 'SRV-WELD', 'welding-work-per-hour', 'Welding work, per hour', 'MIG and TIG welding in our workshop or on site. Billed per started hour.', 'service', 'h', 4500, NULL, 2100, 0, 0, 0, 1, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days')),
 ('prd_demo_custom', 'SRV-CUSTOM', 'custom-fabrication-to-drawing', 'Custom fabrication to drawing', 'Gates, frames, brackets and other parts made to your drawing or sketch. Send the drawing with your request and we reply with a priced quote.', 'service', 'job', NULL, NULL, 2100, 0, 0, 0, 1, '', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days'));

INSERT OR IGNORE INTO stock_movements (id, product_id, quantity, reason, note, created_at) VALUES
 ('mv_demo_mesh_1', 'prd_demo_mesh', 30, 'receipt', 'Supplier delivery', strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),
 ('mv_demo_mesh_2', 'prd_demo_mesh', 12, 'receipt', 'Supplier delivery', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('mv_demo_rebar_1', 'prd_demo_rebar', 6, 'receipt', 'Supplier delivery', strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
 ('mv_demo_gate_1', 'prd_demo_gate', 1, 'receipt', 'Made in the workshop', strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days')),
 ('mv_demo_tube_1', 'prd_demo_tube', 35, 'receipt', 'Supplier delivery', strftime('%Y-%m-%dT%H:%M:%fZ','now','-18 days')),
 ('mv_demo_bracket_1', 'prd_demo_bracket', 100, 'receipt', 'Opening stock', strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days')),
 ('mv_demo_bracket_2', 'prd_demo_bracket', 20, 'receipt', 'Made in the workshop', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
 ('mv_demo_primer_1', 'prd_demo_primer', 18, 'receipt', 'Supplier delivery', strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days'));

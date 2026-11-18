-- Demo website content for the fictional metal workshop (local development only).
-- One page in the site menu, one live post, one scheduled post and one draft,
-- so every status shows in the dashboard. The text describes how the demo
-- system works; it makes no claims about prices, delivery times or quality.
INSERT OR IGNORE INTO content_entries (id, type, slug, title, summary, body, menu_order, status, published_at, created_at, updated_at) VALUES
 ('cnt_demo_about', 'page', 'about', 'About us', 'A small metal workshop: steel products from stock and parts made to your drawing.',
 'We are a small metal workshop. We sell steel products from our [catalogue](/products) and make gates, frames and brackets to your drawing.

## How to order

1. [Send a request](/contact) with the products, quantities and dates you need.
2. We reply with a priced quote. Open it from the email and accept it online.
3. The invoice arrives by email with the bank transfer details.

## Custom work

Send a drawing or a sketch with the dimensions. We price it and send the quote the same way.

> This is demo content. Replace it in Website → Pages.', 1, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days')),

 ('cnt_demo_post_request', 'post', 'what-to-include-in-a-quote-request', 'What to include in a quote request', 'Five details that let us price your order the first time.',
 'A complete request gets a complete quote. Include these details and we can price it without asking back:

- **What you need**: the product name or code from the [catalogue](/products), or a description.
- **Quantity** for each item.
- **Dimensions** for anything made to measure. A sketch or drawing helps.
- **When you need it**, so we can plan the work.
- **Delivery address**, or tell us you will collect it.

## What happens next

We send a quote with every line, the VAT and the total. You can accept it online, and the invoice follows by email.

[Send a request](/contact)', NULL, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days')),

 ('cnt_demo_post_faq', 'post', 'questions-about-quotes-and-invoices', 'Questions about quotes and invoices', 'How quotes, acceptance and invoices work, in short.',
 '## Where do I find my quote?

It arrives by email with a private link. Open it to see every line, the VAT and the total.

## How do I accept it?

Use the Accept button on the quote page. We see it straight away.

## How do I pay?

By bank transfer. The invoice email has the account details and the payment reference.', NULL, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now','+3 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),

 ('cnt_demo_post_draft', 'post', 'finishes-for-outdoor-steel', 'Finishes for outdoor steel', '', 'Draft: compare galvanising and paint for gates and railings. Add facts from the workshop before publishing.', NULL, 'draft', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'));

-- The page with the address "home" replaces the default headline at "/" (title and summary) and adds its text below it.
INSERT OR IGNORE INTO content_entries (id, type, slug, title, summary, body, menu_order, status, published_at, created_at, updated_at) VALUES
 ('cnt_demo_home', 'page', 'home', 'A demo business, built from ready modules', 'Northwind Workshop is fictional. Its website, products, contact form, quotes and invoices all come from the Sistemėlė starter kit. Look around as a customer, then open the dashboard.',
 '## Try it

1. [Send a message](/contact). It arrives in the dashboard as a new lead.
2. [Browse the products](/products). Prices and stock come from the catalog.
3. [Open the dashboard](/app) to work the lead, convert it into a deal, send a quote and issue an invoice.
4. Connect an AI agent over MCP from Settings → API & agents.

> Demo content: edit it in Website → Pages → Home page.', NULL, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'));

-- Demo website content (local development and the public demo). The About page
-- describes Sistemėlė itself; the posts are sample content for the blog.
-- One page in the site menu, one live post, one scheduled post and one draft,
-- so every status shows in the dashboard. The text describes how the demo
-- system works; it makes no claims about prices, delivery times or quality.
INSERT OR IGNORE INTO content_entries (id, type, slug, title, summary, body, menu_order, status, published_at, created_at, updated_at) VALUES
 ('cnt_demo_about', 'page', 'about', 'About Sistemėlė', 'An open-source starter kit and admin panel for AI-native projects, made by aimantas.com.',
 'Sistemėlė ("a little system" in Lithuanian) is a practical starter kit and admin panel for AI-native projects. It gives your coding agent the parts every business app needs, already built and tested, so the agent only builds what is specific to you.

## What runs on this site

This site is the live demo. Its pages, blog, contact form and [products](/products) come from the same code you get. The products, quotes and invoices are sample data, and everything resets every hour.

## What you get

- A public website with pages, a blog and a contact form that lands in a leads inbox
- An admin panel: leads, contacts, a pipeline with your own stages, products and stock, quotes and invoices
- An MCP endpoint, `AGENTS.md`, a README per module and an agent skill
- One Cloudflare Worker and a D1 database, deployed from a button

## Who made it

Sistemėlė is made by [aimantas.com](https://aimantas.com) and published under the MIT licence. The code and guides are on [GitHub](https://github.com/aimantas/sistemele).', 1, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days')),

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

-- No page with the address "home": "/" shows the starter home with the get-started
-- guide (src/worker/site/starter-home.tsx). Publish a "home" page to replace it.

import { Hono } from "hono";
import { config } from "../../../../sistemele.config";
import { documentTotals, formatMoney, formatPercentBps } from "@/shared/money";
import type { ModuleContext } from "@/modules/types.server";
import { getContext } from "@/worker/context";
import { appOrigin, type AppEnv } from "@/worker/env";
import { renderPage } from "@/worker/site/render";
import { breadcrumbJsonLd } from "@/worker/site/seo";
import type { Product } from "../shared/schema";
import { getPublicProduct, listPublicProducts } from "./service";

/**
 * Public product pages: /products and /products/:slug. Server-rendered, no
 * client JavaScript. Only active products marked public are shown. Prices are
 * shown including VAT with the net amount beside them; availability is shown
 * only for products whose stock is tracked.
 */

/** The quote form lives in the CRM module; link to it only when CRM is on. */
const hasContactForm = (config.modules as readonly string[]).includes("crm");

interface Price {
  gross: string;
  net: string;
  vat: string;
  grossCents: number;
}

function priceOf(product: Product, ctx: ModuleContext): Price | null {
  if (product.priceCents === null) return null;
  const totals = documentTotals([{ quantity: 1, unitPriceCents: product.priceCents, vatRateBps: product.vatRateBps }]);
  return {
    gross: formatMoney(totals.totalCents, ctx.currency, ctx.locale),
    net: formatMoney(totals.subtotalCents, ctx.currency, ctx.locale),
    vat: formatPercentBps(product.vatRateBps, ctx.locale),
    grossCents: totals.totalCents,
  };
}

const availability = (product: Product) => (product.trackStock ? (product.stockOnHand > 0 ? "In stock" : "Out of stock") : null);

/** First paragraph, cut at a word boundary. */
function excerpt(text: string, max = 160): string {
  const first = text.trim().split(/\n\s*\n/u)[0]?.replace(/\s+/gu, " ") ?? "";
  if (first.length <= max) return first;
  return `${first.slice(0, max).replace(/\s+\S*$/u, "")}…`;
}

const absolute = (origin: string, url: string) => (url.startsWith("/") ? `${origin}${url}` : url);

function PriceBlock({ price, unit, large }: { price: Price | null; unit: string; large?: boolean }) {
  if (!price) return <p className="price">Price on request</p>;
  return (
    <div>
      <p className="price" style={{ margin: 0, fontSize: large ? "1.75rem" : undefined }}>
        {price.gross} <span className="small muted">/ {unit}</span>
      </p>
      <p className="small muted" style={{ margin: 0 }}>
        incl. VAT {price.vat} · {price.net} excl. VAT
      </p>
    </div>
  );
}

function AvailabilityBadge({ product }: { product: Product }) {
  const label = availability(product);
  if (!label) return null;
  return (
    <div>
      <span className={product.stockOnHand > 0 ? "badge" : "badge out"}>{label}</span>
    </div>
  );
}

export const catalogSite = new Hono<AppEnv>()
  .get("/products", async (c) => {
    const ctx = getContext(c);
    const origin = appOrigin(c.env);
    const business = await ctx.business();
    const products = await listPublicProducts(ctx);
    const description = `Products and services from ${business.name} with prices including VAT.${hasContactForm ? " Request a quote online for quantities and delivery." : ""}`;
    const markdown = [
      "# Products",
      "",
      "Prices include VAT; the net price is shown after it.",
      "",
      ...(products.length
        ? products.map((product) => {
            const price = priceOf(product, ctx);
            const parts = [price ? `${price.gross} per ${product.unit} incl. VAT (${price.net} excl. VAT)` : "price on request", availability(product)?.toLowerCase()].filter(Boolean);
            return `- [${product.name}](${origin}/products/${product.slug}): ${parts.join(", ")}`;
          })
        : ["No products are listed yet."]),
      ...(hasContactForm ? ["", `[Request a quote](${origin}/contact)`] : []),
      "",
    ].join("\n");

    return renderPage(c, {
      meta: { title: "Products", description, path: "/products", jsonLd: [breadcrumbJsonLd(origin, [{ name: "Home", path: "/" }, { name: "Products", path: "/products" }])] },
      markdown,
      body: (
        <section className="section">
          <div className="wrap">
            <h1>Products</h1>
            <p className="lead">Prices include VAT. {hasContactForm ? "For quantities, sizes or delivery, request a quote." : null}</p>
            {products.length === 0 ? (
              <div className="notice">
                <p style={{ margin: 0 }}>No products are listed yet.{hasContactForm ? " Tell us what you need and we will reply with a price." : null}</p>
                {hasContactForm ? (
                  <div className="actions" style={{ marginTop: 16 }}>
                    <a className="button primary" href="/contact">
                      Request a quote
                    </a>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="grid" style={{ listStyle: "none", padding: 0 }}>
                {products.map((product) => (
                  <li key={product.id} className="card">
                    <a href={`/products/${product.slug}`}>
                      <h2 style={{ fontSize: "1.125rem", margin: 0 }}>{product.name}</h2>
                    </a>
                    {product.description ? <p className="small muted" style={{ margin: 0 }}>{excerpt(product.description, 140)}</p> : null}
                    <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
                      <PriceBlock price={priceOf(product, ctx)} unit={product.unit} />
                      <AvailabilityBadge product={product} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {products.length > 0 && hasContactForm ? (
              <div className="actions">
                <a className="button primary" href="/contact">
                  Request a quote
                </a>
              </div>
            ) : null}
          </div>
        </section>
      ),
    });
  })

  .get("/products/:slug", async (c) => {
    const ctx = getContext(c);
    const product = await getPublicProduct(ctx, c.req.param("slug"));
    if (!product) return c.notFound();
    const origin = appOrigin(c.env);
    const business = await ctx.business();
    const path = `/products/${product.slug}`;
    const url = `${origin}${path}`;
    const price = priceOf(product, ctx);
    const label = availability(product);
    const image = product.imageUrl ? absolute(origin, product.imageUrl) : undefined;
    const summary = excerpt(product.description, 155);
    const description = summary || `${product.name} from ${business.name}. ${price ? `${price.gross} per ${product.unit} including VAT.` : "Price on request."}`;

    // Structured data describes only what the page shows; an Offer needs a real price.
    const productJsonLd = price
      ? {
          "@context": "https://schema.org",
          "@type": product.kind === "service" ? "Service" : "Product",
          name: product.name,
          ...(product.description ? { description: product.description } : {}),
          ...(product.kind === "product" ? { sku: product.sku } : { provider: { "@type": "Organization", name: business.legalName || business.name, url: origin } }),
          ...(image ? { image } : {}),
          url,
          offers: {
            "@type": "Offer",
            url,
            price: (price.grossCents / 100).toFixed(2),
            priceCurrency: ctx.currency,
            priceSpecification: { "@type": "UnitPriceSpecification", price: (price.grossCents / 100).toFixed(2), priceCurrency: ctx.currency, valueAddedTaxIncluded: true, unitText: product.unit },
            ...(product.trackStock ? { availability: product.stockOnHand > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } : {}),
          },
        }
      : null;

    const markdown = [
      `# ${product.name}`,
      "",
      price ? `Price: ${price.gross} per ${product.unit} incl. VAT ${price.vat} (${price.net} excl. VAT)` : "Price: on request",
      ...(label ? [`Availability: ${label.toLowerCase()}`] : []),
      ...(product.kind === "product" ? [`SKU: ${product.sku}`] : []),
      "",
      ...(product.description ? [product.description, ""] : []),
      ...(hasContactForm ? [`[Request a quote](${origin}/contact)`, ""] : []),
      `[All products](${origin}/products)`,
      "",
    ].join("\n");

    return renderPage(c, {
      meta: {
        title: product.name,
        description,
        path,
        ogType: "product",
        ogImage: image,
        jsonLd: [
          breadcrumbJsonLd(origin, [
            { name: "Home", path: "/" },
            { name: "Products", path: "/products" },
            { name: product.name, path },
          ]),
          ...(productJsonLd ? [productJsonLd] : []),
        ],
      },
      markdown,
      body: (
        <section className="section">
          <div className="wrap narrow">
            <nav aria-label="Breadcrumb" className="small muted">
              <p>
                <a href="/">Home</a> › <a href="/products">Products</a>
              </p>
            </nav>
            <h1>{product.name}</h1>
            {image ? <img src={image} alt={product.name} style={{ borderRadius: 10, border: "1px solid var(--line)", marginBottom: 24 }} /> : null}
            <div className="card" style={{ marginBottom: 24 }}>
              <PriceBlock price={price} unit={product.unit} large />
              <AvailabilityBadge product={product} />
              {product.kind === "product" ? <p className="small muted" style={{ margin: 0 }}>SKU {product.sku}</p> : null}
              {hasContactForm ? (
                <div className="actions" style={{ marginTop: 8 }}>
                  <a className="button primary" href="/contact">
                    Request a quote
                  </a>
                </div>
              ) : null}
            </div>
            {product.description
              ? product.description
                  .split(/\n\s*\n/u)
                  .filter((paragraph) => paragraph.trim())
                  .map((paragraph, index) => (
                    <p key={index} style={{ whiteSpace: "pre-line" }}>
                      {paragraph.trim()}
                    </p>
                  ))
              : null}
            <p>
              <a href="/products">All products</a>
            </p>
          </div>
        </section>
      ),
    });
  });

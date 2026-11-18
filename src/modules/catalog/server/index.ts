import type { ServerModule } from "@/modules/types.server";
import { catalogApi } from "./routes";
import { deductInvoiceStock, listPublicProducts, lowStockSummary, reverseInvoiceStock, searchProducts, stockValue } from "./service";
import { catalogSite } from "./site";
import { catalogTools } from "./tools";

/**
 * Catalog module: products and services, prices, and stock kept as a ledger.
 * See src/modules/catalog/README.md.
 */
export const catalogModule: ServerModule = {
  id: "catalog",
  name: "Catalog",
  description: "Products, services, prices and stock levels.",
  api: catalogApi,
  site: catalogSite,
  siteLinks: [{ label: "Products", href: "/products" }],
  tools: catalogTools,

  metrics: [
    {
      key: "catalog.low_stock_count",
      label: "Low stock",
      description: "Active products with stock tracking at or below their reorder point, including out of stock.",
      format: "number",
      async compute(ctx) {
        const { low, out } = await lowStockSummary(ctx);
        return { value: low, hint: `${out} out of stock` };
      },
    },
    {
      key: "catalog.stock_value",
      label: "Stock value",
      description: "Stock on hand multiplied by cost price, for active products with stock tracking.",
      format: "money",
      async compute(ctx) {
        const { valueCents, missingCost } = await stockValue(ctx);
        return { value: valueCents, hint: missingCost ? `at cost · ${missingCost} without a cost price` : "at cost" };
      },
    },
  ],

  events: {
    async "invoice.issued"({ invoiceId, number, lines }, ctx) {
      await deductInvoiceStock(ctx, { invoiceId, number, lines });
    },
    async "invoice.voided"({ invoiceId, number }, ctx) {
      await reverseInvoiceStock(ctx, { invoiceId, number });
    },
  },

  search: (term, ctx) => searchProducts(ctx, term),

  async sitemap(ctx) {
    const products = await listPublicProducts(ctx);
    const latest = products.reduce((max, product) => (product.updatedAt > max ? product.updatedAt : max), "");
    return [
      { path: "/products", changefreq: "weekly", priority: 0.8, ...(latest ? { lastmod: latest } : {}) },
      ...products.map((product) => ({ path: `/products/${product.slug}`, lastmod: product.updatedAt, changefreq: "weekly" as const, priority: 0.6 })),
    ];
  },
};

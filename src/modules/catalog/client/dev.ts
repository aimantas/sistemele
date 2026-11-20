import type { DevPage } from "@/modules/types.client";

/** Developer panel notes and agent prompts for the catalog pages (dev mode). */
export const catalogDev: DevPage[] = [
  {
    path: "catalog/products",
    title: "Products",
    summary: "Products and services with prices, VAT, units and stock levels; the public /products page reads them.",
    files: [
      { path: "src/modules/catalog/client/ProductsPage.tsx", note: "List, filters, new product" },
      { path: "src/modules/catalog/client/ProductForm.tsx", note: "Product form" },
      { path: "src/modules/catalog/server/service.ts", note: "Product and stock services" },
      { path: "src/modules/catalog/server/site.tsx", note: "Public /products pages" },
      { path: "migrations/0003_catalog.sql", note: "Products and stock tables" },
      { path: "tests/catalog.test.ts", note: "Catalog tests" },
    ],
    tools: ["catalog_list_products", "catalog_create_product", "catalog_update_product"],
    prompts: [
      "Add product categories with a category filter in the admin list and category pages on the public site.",
      "Add product images (URL for now) shown in the admin list and on public product pages with Product structured data.",
      "Add price tiers by quantity and use them when a product is added to a quote.",
    ],
  },
  {
    path: "catalog/products/:id",
    title: "Product",
    summary: "One product: details, price, stock on hand, reorder point and stock movements.",
    files: [
      { path: "src/modules/catalog/client/ProductDetailPage.tsx", note: "Product page" },
      { path: "src/modules/catalog/client/StockDialog.tsx", note: "Adjust stock" },
      { path: "src/modules/catalog/server/service.ts", note: "Stock movements" },
    ],
    tools: ["catalog_get_product", "catalog_adjust_stock"],
    prompts: ["Show a 90-day stock chart on the product page from its stock movements."],
  },
  {
    path: "catalog/movements",
    title: "Stock movements",
    summary: "Every stock change: received, sold, adjusted, with who and why.",
    files: [
      { path: "src/modules/catalog/client/MovementsPage.tsx", note: "Movements list" },
      { path: "src/modules/catalog/server/service.ts", note: "Stock services" },
    ],
    tools: ["catalog_list_low_stock", "catalog_adjust_stock"],
    prompts: ["Email owners a weekly low-stock report listing products under their reorder point."],
  },
];

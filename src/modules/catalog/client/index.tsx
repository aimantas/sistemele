import { ArrowLeftRight, Package, PackagePlus } from "lucide-react";
import { lazy } from "react";
import type { ClientModule } from "@/modules/types.client";

/** Catalog, browser side. Pages and widgets load lazily. See src/modules/catalog/README.md. */
export const catalogClient: ClientModule = {
  id: "catalog",
  name: "Catalog",
  nav: [
    { to: "/app/catalog/products", label: "Products", icon: Package },
    { to: "/app/catalog/movements", label: "Stock", icon: ArrowLeftRight },
  ],
  routes: [
    { path: "catalog/products", lazy: () => import("./ProductsPage").then((m) => ({ Component: m.default })) },
    { path: "catalog/products/:id", lazy: () => import("./ProductDetailPage").then((m) => ({ Component: m.default })) },
    { path: "catalog/movements", lazy: () => import("./MovementsPage").then((m) => ({ Component: m.default })) },
  ],
  widgets: [
    { type: "catalog.low-stock", title: "Low stock", description: "Products at or below their reorder point.", defaultSize: { w: 2, h: 1 }, component: lazy(() => import("./widgets").then((m) => ({ default: m.LowStockWidget }))) },
    { type: "catalog.recent-movements", title: "Stock movements", description: "Latest deliveries, sales, returns and counts.", defaultSize: { w: 2, h: 2 }, component: lazy(() => import("./widgets").then((m) => ({ default: m.RecentMovementsWidget }))) },
  ],
  quickActions: [{ label: "New product", to: "/app/catalog/products?new=1", icon: PackagePlus }],
};

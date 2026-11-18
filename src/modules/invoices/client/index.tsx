import { FilePlus2, Receipt } from "lucide-react";
import { lazy } from "react";
import type { ClientModule } from "@/modules/types.client";

/** Invoices, browser side. Pages are lazy routes so the module only loads when used. */
export const invoicesClient: ClientModule = {
  id: "invoices",
  name: "Invoices",
  nav: [{ to: "/app/invoices", label: "Invoices", icon: Receipt }],
  routes: [
    { path: "invoices", lazy: () => import("./InvoicesPage").then((m) => ({ Component: m.default })) },
    { path: "invoices/new", lazy: () => import("./InvoiceEditorPage").then((m) => ({ Component: m.default })) },
    { path: "invoices/:id", lazy: () => import("./InvoiceDetailPage").then((m) => ({ Component: m.default })) },
    { path: "invoices/:id/edit", lazy: () => import("./InvoiceEditorPage").then((m) => ({ Component: m.default })) },
  ],
  widgets: [
    {
      type: "invoices.overdue",
      title: "Overdue invoices",
      description: "Issued invoices past their due date, with the amount still owed.",
      defaultSize: { w: 2, h: 1 },
      component: lazy(() => import("./widgets").then((m) => ({ default: m.OverdueInvoicesWidget }))),
    },
  ],
  quickActions: [{ label: "New invoice", to: "/app/invoices/new", icon: FilePlus2 }],
};

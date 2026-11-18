import { FilePlus2, FileText } from "lucide-react";
import { lazy } from "react";
import type { ClientModule } from "@/modules/types.client";

/** Quotes, browser side. Pages are lazy routes; see src/modules/quotes/README.md. */
export const quotesClient: ClientModule = {
  id: "quotes",
  name: "Quotes",
  nav: [{ to: "/app/quotes", label: "Quotes", icon: FileText }],
  routes: [
    { path: "quotes", lazy: () => import("./QuotesPage").then((m) => ({ Component: m.default })) },
    { path: "quotes/new", lazy: () => import("./QuoteEditorPage").then((m) => ({ Component: m.default })) },
    { path: "quotes/:id", lazy: () => import("./QuoteDetailPage").then((m) => ({ Component: m.default })) },
    { path: "quotes/:id/edit", lazy: () => import("./QuoteEditorPage").then((m) => ({ Component: m.default })) },
  ],
  widgets: [
    {
      type: "quotes.awaiting",
      title: "Quotes awaiting answer",
      description: "Sent quotes, oldest first, with days waiting and expiry warnings.",
      defaultSize: { w: 2, h: 2 },
      component: lazy(() => import("./widgets").then((m) => ({ default: m.AwaitingQuotesWidget }))),
    },
  ],
  quickActions: [{ label: "New quote", to: "/app/quotes/new", icon: FilePlus2 }],
};

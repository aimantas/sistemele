import { config } from "../../sistemele.config";
import { catalogClient } from "./catalog/client";
import { crmClient } from "./crm/client";
import { invoicesClient } from "./invoices/client";
import { quotesClient } from "./quotes/client";
import type { ClientModule } from "./types.client";
import { contentClient } from "./content/client";

/** Browser side of every available module. Mirrors src/modules/server.ts. */
const available: Record<string, ClientModule> = {
  crm: crmClient,
  catalog: catalogClient,
  quotes: quotesClient,
  invoices: invoicesClient,
  content: contentClient,
};

export const clientModules: ClientModule[] = config.modules.map((id) => {
  const module = available[id];
  if (!module) throw new Error(`Unknown module "${id}" in sistemele.config.ts`);
  return module;
});

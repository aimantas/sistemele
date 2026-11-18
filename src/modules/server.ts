import { config } from "../../sistemele.config";
import { catalogModule } from "./catalog/server";
import { crmModule } from "./crm/server";
import { invoicesModule } from "./invoices/server";
import { quotesModule } from "./quotes/server";
import type { ServerModule } from "./types.server";
import { contentModule } from "./content/server";

/**
 * Server side of every available module. To add one: create
 * src/modules/<id>/server/index.ts, import it here, and add its id to
 * `modules` in sistemele.config.ts (or run `npm run module:new <id>`).
 */
const available: Record<string, ServerModule> = {
  crm: crmModule,
  catalog: catalogModule,
  quotes: quotesModule,
  invoices: invoicesModule,
  content: contentModule,
};

export const serverModules: ServerModule[] = config.modules.map((id) => {
  const module = available[id];
  if (!module) throw new Error(`Unknown module "${id}" in sistemele.config.ts`);
  return module;
});

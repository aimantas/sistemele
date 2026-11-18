import { serverModules } from "@/modules/server";
import { createApp } from "./app";
import { scheduledDemoReset } from "./demo";
import type { Env } from "./env";

/** Cloudflare Worker entry. Everything is wired in ./app.ts. */
const app = createApp(serverModules);

export default {
  fetch: app.fetch,
  /** Cron Triggers. A demo deployment resets its data here; other installations have no triggers. */
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(scheduledDemoReset(env));
  },
} satisfies ExportedHandler<Env>;

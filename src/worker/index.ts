import { serverModules } from "@/modules/server";
import { createApp } from "./app";

/** Cloudflare Worker entry. Everything is wired in ./app.ts. */
const app = createApp(serverModules);

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<import("./env").Env>;

import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const nodeRuntime = process.env.CID_RUNTIME === "node";

export default defineConfig({
  output: "server",
  adapter: nodeRuntime ? node({ mode: "standalone" }) : cloudflare({ configPath: process.env.CID_WRANGLER_CONFIG }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ...(nodeRuntime ? { resolve: { alias: { "cloudflare:workers": fileURLToPath(new URL("./src/lib/node-runtime.ts", import.meta.url)) } } } : {}),
  },
});

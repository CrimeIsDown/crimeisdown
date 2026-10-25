import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { "cloudflare:workers": fileURLToPath(new URL("./src/lib/cloudflare-local.ts", import.meta.url)) } },
    server: {
      allowedHosts: ["mini"],
    },
  },
});

import path from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

// Serves /api/signals during `vite dev` using the same fetcher the Vercel
// function uses, so live data works locally and in production.
function localApi(): Plugin {
  return {
    name: "local-api",
    configureServer(server) {
      server.middlewares.use("/api/signals", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const track = url.searchParams.get("track") ?? "";
          const modUrl = pathToFileURL(path.join(process.cwd(), "api/sources.mjs")).href;
          const mod = (await import(modUrl)) as {
            getListings: (t: string) => Promise<unknown[]>;
          };
          const listings = await mod.getListings(track);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ track, count: listings.length, listings }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e), listings: [] }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
});

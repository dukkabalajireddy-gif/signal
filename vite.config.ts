import path from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";

const importApi = (file: string) =>
  import(pathToFileURL(path.join(process.cwd(), "api", file)).href);

// Serves /api/signals and /api/gcc during `vite dev` using the same code the
// Vercel functions use, so everything works locally and in production.
function localApi(): Plugin {
  return {
    name: "local-api",
    configureServer(server) {
      server.middlewares.use("/api/signals", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const track = url.searchParams.get("track") ?? "";
          const fresh = url.searchParams.get("fresh") != null;
          const mod = (await importApi("sources.mjs")) as {
            getListings: (t: string, o?: { fresh?: boolean }) => Promise<unknown[]>;
          };
          const listings = await mod.getListings(track, { fresh });
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ track, count: listings.length, listings }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e), listings: [] }));
        }
      });

      server.middlewares.use("/api/gcc", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const fresh = url.searchParams.get("fresh") != null;
          const mod = (await importApi("gemini.mjs")) as {
            discoverGCCs: (f?: boolean) => Promise<unknown>;
          };
          const result = await mod.discoverGCCs(fresh);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ configured: true, error: String(e), listings: [] }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Make .env values (e.g. GEMINI_API_KEY) available to the dev middleware.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  return { plugins: [react(), tailwindcss(), localApi()] };
});

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
          const mod = (await importApi("_lib/sources.mjs")) as {
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

      server.middlewares.use("/api/discover", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const type = url.searchParams.get("type") ?? "startup";
          const fresh = url.searchParams.get("fresh") != null;
          const mod = (await importApi("_lib/discovery.mjs")) as {
            discoverAny: (t: string, f?: boolean) => Promise<unknown>;
          };
          const result = await mod.discoverAny(type, fresh);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ configured: true, error: String(e), listings: [] }));
        }
      });

      server.middlewares.use("/api/state", async (req, res) => {
        try {
          const mod = (await importApi("_lib/store.mjs")) as {
            getState: () => Promise<unknown>;
            applyOp: (op: string, p?: Record<string, unknown>) => Promise<unknown>;
          };
          res.setHeader("content-type", "application/json");
          if (req.method === "POST") {
            let data = "";
            for await (const chunk of req) data += chunk;
            const body = data ? JSON.parse(data) : {};
            const { op, ...rest } = body;
            res.end(JSON.stringify(await mod.applyOp(op, rest)));
            return;
          }
          res.end(JSON.stringify(await mod.getState()));
        } catch (e) {
          res.statusCode = 200;
          res.end(JSON.stringify({ configured: false, error: String(e) }));
        }
      });

      server.middlewares.use("/api/enrich", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const company = url.searchParams.get("company") ?? "";
          const domain = url.searchParams.get("domain") ?? "";
          const fresh = url.searchParams.get("fresh") != null;
          const mod = (await importApi("_lib/hunter.mjs")) as {
            enrichCompany: (c: string, d?: string, f?: boolean) => Promise<unknown>;
          };
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(await mod.enrichCompany(company, domain, fresh)));
        } catch (e) {
          res.statusCode = 200;
          res.end(JSON.stringify({ configured: true, error: String(e) }));
        }
      });

      server.middlewares.use("/api/go", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const u = url.searchParams.get("u") || "";
          const c = url.searchParams.get("c") || "";
          const mod = (await importApi("_lib/apply.mjs")) as {
            resolveApply: (u: string, c?: string) => Promise<string>;
            allowedHost: (u: string) => boolean;
          };
          let target = u;
          if (u && mod.allowedHost(u)) target = await mod.resolveApply(u, c);
          res.statusCode = 302;
          res.setHeader("Location", /^https?:\/\//.test(target) ? target : u || "/");
          res.end();
        } catch {
          res.statusCode = 302;
          res.setHeader("Location", "/");
          res.end();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Make .env API keys available to the dev middleware.
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of ["GROQ_API_KEY", "SERPAPI_KEY", "HUNTER_API_KEY"]) {
    if (env[k]) process.env[k] = env[k];
  }
  return { plugins: [react(), tailwindcss(), localApi()] };
});

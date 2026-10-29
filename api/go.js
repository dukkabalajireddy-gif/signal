// Vercel serverless function: GET /api/go?u=<postUrl>&c=<company>
// Resolves an aggregator post to the company's real apply link and redirects.
// Falls back to the original post if nothing better is found.
import { resolveApply, allowedHost } from "./apply.mjs";

export default async function handler(req, res) {
  const u = (req.query?.u || "").toString();
  const c = (req.query?.c || "").toString();
  let target = u;
  if (u && allowedHost(u)) {
    try {
      target = await resolveApply(u, c);
    } catch {
      target = u;
    }
  }
  if (!/^https?:\/\//.test(target)) target = u || "https://jobalertshub.com";
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.writeHead(302, { Location: target });
  res.end();
}

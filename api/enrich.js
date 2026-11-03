// Vercel serverless function: GET /api/enrich?company=&domain=&fresh=
// Returns the best HR / recruiting contact for a company via Hunter.io.
import { enrichCompany } from "./enrich.mjs";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const company = url.searchParams.get("company") || "";
    const domain = url.searchParams.get("domain") || "";
    const fresh = url.searchParams.get("fresh") != null;
    const result = await enrichCompany(company, domain, fresh);
    // Cache real hits at the edge for a day; let misses/errors self-heal.
    if (result.configured && result.contact) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }
    res.status(200).json(result);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ configured: true, error: String(e) });
  }
}

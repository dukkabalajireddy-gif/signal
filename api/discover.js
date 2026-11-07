// Vercel serverless function: GET /api/discover?type=gcc|startup
// LLM-powered discovery (Groq preferred, Gemini fallback). Cached 1h.
import { discoverAny } from "./_lib/discovery.mjs";

export default async function handler(req, res) {
  const type = (req.query?.type || "startup").toString();
  const fresh = req.query?.fresh != null;
  try {
    const result = await discoverAny(type, fresh);
    const cacheable = result.configured && !result.error && (result.listings?.length ?? 0) > 0;
    res.setHeader(
      "Cache-Control",
      fresh || !cacheable ? "no-store" : "s-maxage=3600, stale-while-revalidate=7200",
    );
    res.status(200).json({ ...result, fetchedAt: Date.now() });
  } catch (e) {
    res.status(200).json({ configured: true, error: String(e), listings: [] });
  }
}

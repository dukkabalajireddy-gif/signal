// Vercel serverless function: GET /api/discover?type=gcc|startup
// Gemini-powered discovery. Cached 1h (LLM calls cost quota).
import { discover } from "./gemini.mjs";

export default async function handler(req, res) {
  const type = (req.query?.type || "gcc").toString();
  const fresh = req.query?.fresh != null;
  try {
    const result = await discover(type, fresh);
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

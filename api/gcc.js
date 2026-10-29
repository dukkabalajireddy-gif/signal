// Vercel serverless function: GET /api/gcc
// Gemini-powered GCC discovery. Cached 1h (LLM calls cost quota).
import { discoverGCCs } from "./gemini.mjs";

export default async function handler(req, res) {
  const fresh = req.query?.fresh != null;
  try {
    const result = await discoverGCCs(fresh);
    // Only cache successful, non-empty results — so a "needs key"/error state
    // self-heals on the next load once the key is live.
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

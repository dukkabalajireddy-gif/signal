// Vercel serverless function: GET /api/signals?track=ai-engineer
// Returns live listings for a track as JSON. CDN-cached for 10 min.
import { getListings } from "./sources.mjs";

export default async function handler(req, res) {
  const track = (req.query?.track || "").toString();
  try {
    const listings = await getListings(track);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
    res.status(200).json({ track, count: listings.length, listings });
  } catch (e) {
    res.status(500).json({ track, error: String(e), listings: [] });
  }
}

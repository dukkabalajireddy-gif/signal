// Vercel serverless function: GET /api/state (shared team state),
// POST /api/state with { op, ... } to apply one change. No caching.
import { getState, applyOp } from "./store.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { op, ...rest } = body;
      res.status(200).json(await applyOp(op, rest));
      return;
    }
    res.status(200).json(await getState());
  } catch (e) {
    res.status(200).json({ configured: false, error: String(e) });
  }
}

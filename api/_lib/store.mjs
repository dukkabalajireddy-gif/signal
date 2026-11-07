// Shared team store (Vercel KV / Upstash Redis via REST).
//
// Holds the team's pipeline, archived items and deleted ids so everyone sees
// one shared view. Reads connection from env (set via Vercel's KV integration
// or Upstash). Without it, getState returns { configured: false } and the app
// falls back to per-browser localStorage.

function env(...names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  return "";
}
const restUrl = () => env("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
const restToken = () => env("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");

export function storeConfigured() {
  return !!(restUrl() && restToken());
}

const K = { pipeline: "signal:pipeline", archived: "signal:archived", deleted: "signal:deleted" };

async function kvGet(key) {
  const r = await fetch(`${restUrl()}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${restToken()}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (j.result == null) return null;
  try {
    return JSON.parse(j.result);
  } catch {
    return null;
  }
}
async function kvSet(key, val) {
  await fetch(`${restUrl()}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${restToken()}`, "content-type": "text/plain" },
    body: JSON.stringify(val),
  });
}

export async function getState() {
  if (!storeConfigured()) return { configured: false };
  const [pipeline, archived, deleted] = await Promise.all([
    kvGet(K.pipeline),
    kvGet(K.archived),
    kvGet(K.deleted),
  ]);
  return { configured: true, pipeline: pipeline || [], archived: archived || [], deleted: deleted || [] };
}

// Apply a single operation with a server-side read-modify-write, then return
// the fresh shared state. Keeps concurrent edits on different items from
// clobbering each other.
export async function applyOp(op, p = {}) {
  if (!storeConfigured()) return { configured: false };
  if (op === "pipeline.add") {
    const list = (await kvGet(K.pipeline)) || [];
    if (p.item && !list.some((x) => x.id === p.item.id)) list.unshift({ ...p.item, stage: "spotted" });
    await kvSet(K.pipeline, list);
  } else if (op === "pipeline.move") {
    const list = (await kvGet(K.pipeline)) || [];
    await kvSet(K.pipeline, list.map((x) => (x.id === p.id ? { ...x, stage: p.stage } : x)));
  } else if (op === "pipeline.remove") {
    const list = (await kvGet(K.pipeline)) || [];
    await kvSet(K.pipeline, list.filter((x) => x.id !== p.id));
  } else if (op === "archive") {
    const list = (await kvGet(K.archived)) || [];
    if (p.item && !list.some((x) => x.id === p.item.id)) list.unshift({ ...p.item, status: "archived" });
    await kvSet(K.archived, list);
  } else if (op === "unarchive") {
    const list = (await kvGet(K.archived)) || [];
    await kvSet(K.archived, list.filter((x) => x.id !== p.id));
  } else if (op === "delete") {
    const [del, arch] = await Promise.all([kvGet(K.deleted), kvGet(K.archived)]);
    const d = new Set(del || []);
    d.add(p.id);
    await Promise.all([kvSet(K.deleted, [...d]), kvSet(K.archived, (arch || []).filter((x) => x.id !== p.id))]);
  }
  return getState();
}

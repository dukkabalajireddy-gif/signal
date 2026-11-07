// Groq-powered discovery (GCCs and startups), mirroring the Gemini path.
//
// Groq runs open models (Llama etc.) via an OpenAI-compatible endpoint with a
// generous free tier. No web search, so it discovers from model knowledge —
// same ICP prompts as Gemini, same card shape. Reads GROQ_API_KEY from env.
import { PROMPTS, extractArray, mapDiscovery } from "./gemini.mjs";

// Fallback if the models endpoint can't be reached. Model IDs rotate, so we
// prefer asking Groq which ones exist (see pickModels) over hardcoding.
const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.1-8b-instant",
];

let modelCache = { at: 0, list: [] };

// Ask Groq which chat models the account can actually use, ranked best-first,
// so retired/no-access model IDs don't silently break discovery.
async function pickModels(key) {
  if (modelCache.list.length && Date.now() - modelCache.at < 60 * 60000) return modelCache.list;
  let ids = [];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { authorization: `Bearer ${key}` },
    });
    const j = await r.json();
    ids = (j?.data || [])
      .map((m) => m.id)
      .filter((id) => /llama|qwen|kimi|gpt-oss|gemma|mixtral/i.test(id) && !/guard|whisper|tts|embed|prompt-guard/i.test(id));
  } catch {
    /* fall back below */
  }
  const rank = (id) =>
    /70b|versatile/i.test(id) ? 0 : /maverick/i.test(id) ? 1 : /scout|gpt-oss|qwen|kimi/i.test(id) ? 2 : /instant|8b/i.test(id) ? 3 : 4;
  const list = (ids.length ? ids : FALLBACK_MODELS).slice().sort((a, b) => rank(a) - rank(b));
  modelCache = { at: Date.now(), list };
  return list;
}

function apiKey() {
  const direct = process.env.GROQ_API_KEY || process.env.Groq_signal || process.env.GROQ_KEY;
  if (direct) return direct;
  // Robust fallback: pick up the key whatever it was named in Vercel, as long
  // as the var name contains "groq" (case-insensitive). Avoids casing traps.
  for (const [k, v] of Object.entries(process.env)) {
    if (v && /groq/i.test(k)) return v;
  }
  return "";
}

export function groqConfigured() {
  return !!apiKey();
}

const cache = {}; // keyed by type → { at, data }

async function callGroq(model, key, prompt) {
  let r, j;
  try {
    r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.6, messages: [{ role: "user", content: prompt }] }),
    });
    j = await r.json();
  } catch (e) {
    return { error: `${model}: ${String(e)}`, text: "" };
  }
  if (!r.ok) return { error: j?.error?.message || `${model}: HTTP ${r.status}`, text: "" };
  const text = j?.choices?.[0]?.message?.content || "";
  return { error: "", text };
}

export async function discoverGroq(type, fresh = false) {
  const key = apiKey();
  if (!key) return { configured: false, listings: [] };
  const prompt = (PROMPTS[type] || PROMPTS.gcc) + "\nReturn ONLY the JSON array, no prose.";
  if (!fresh && cache[type] && Date.now() - cache[type].at < 60 * 60000) return cache[type].data;

  const MODELS = await pickModels(key);
  const errors = [];
  let arr = null;
  for (const model of MODELS) {
    const res = await callGroq(model, key, prompt);
    if (res.error) {
      errors.push(res.error);
      continue;
    }
    const parsed = extractArray(res.text);
    if (parsed && parsed.length) {
      arr = parsed;
      break;
    }
    errors.push(`${model}: no parseable results`);
  }

  if (!arr || !arr.length) {
    const why = errors.join(" | ").slice(0, 300) || "Groq returned no results.";
    if (cache[type]?.data?.listings?.length) return { ...cache[type].data, error: why };
    return { configured: true, listings: [], error: why };
  }

  const listings = mapDiscovery(type, arr, "Groq · discovery");
  const data = { configured: true, listings };
  cache[type] = { at: Date.now(), data };
  return data;
}

// Groq-powered discovery (GCCs and startups), mirroring the Gemini path.
//
// Groq runs open models (Llama etc.) via an OpenAI-compatible endpoint with a
// generous free tier. No web search, so it discovers from model knowledge —
// same ICP prompts as Gemini, same card shape. Reads GROQ_API_KEY from env.
import { PROMPTS, extractArray, mapDiscovery } from "./gemini.mjs";

const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

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

// Gemini-powered GCC discovery.
//
// Finds GCCs / global companies' India offices hiring AI & software talent,
// with a careers page and any PUBLIC talent-acquisition contact — each meant
// to be verified via the careers link. Reads the key from env (set it in
// Vercel). Without a key it returns { configured: false } so the UI can show a
// setup message.

const MODELS = ["gemini-3.8-flash", "gemini-flash-latest"];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// Accept a few env var names so whatever the key is stored under works.
function apiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.Gemini_signal ||
    process.env.GEMINI_SIGNAL ||
    process.env.GEMINI_KEY ||
    ""
  );
}

export function geminiConfigured() {
  return !!apiKey();
}

function extractArray(text) {
  if (!text) return null;
  const tries = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) tries.push(fence[1]);
  const bracket = text.match(/\[[\s\S]*\]/);
  if (bracket) tries.push(bracket[0]);
  tries.push(text);
  for (const t of tries) {
    try {
      const v = JSON.parse(t.trim());
      if (Array.isArray(v)) return v;
    } catch {
      /* try next */
    }
  }
  return null;
}

const PROMPT = `List 12 to 15 Global Capability Centers (GCCs) or global companies' India offices (captive centers) that hire AI/ML and software engineering talent in India. Prefer ones actively hiring right now.
For each, return a JSON object:
{"company": string, "city": string (an Indian city where they hire), "role": string (a representative AI/ML or software role), "careersUrl": string (their India careers/jobs page URL), "contact": string (a PUBLIC talent-acquisition email or recruiter page URL if known, else "")}
Return ONLY a JSON array of these objects.`;

// useSearch adds Google Search grounding (live web); without it we use JSON mode
// for clean, parseable output straight from the model's knowledge.
async function callModel(model, key, useSearch) {
  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: useSearch
      ? { temperature: 0.5 }
      : { temperature: 0.4, responseMimeType: "application/json" },
  };
  if (useSearch) body.tools = [{ google_search: {} }];

  let r, j;
  try {
    r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    j = await r.json();
  } catch (e) {
    return { error: `${model}: ${String(e)}`, text: "" };
  }
  if (!r.ok) return { error: j?.error?.message || `${model}: HTTP ${r.status}`, text: "" };
  const text = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  return { error: "", text };
}

let cache = { at: 0, data: null };

export async function discoverGCCs(fresh = false) {
  const key = apiKey();
  if (!key) return { configured: false, listings: [] };
  if (!fresh && cache.data && Date.now() - cache.at < 60 * 60000) return cache.data;

  const errors = [];
  let arr = null;
  // Try with grounding first (live web), then without (model knowledge).
  outer: for (const useSearch of [true, false]) {
    for (const model of MODELS) {
      const res = await callModel(model, key, useSearch);
      const tag = `${model}${useSearch ? "+search" : ""}`;
      if (res.error) {
        errors.push(`${tag}: ${res.error}`);
        continue;
      }
      const parsed = extractArray(res.text);
      if (parsed && parsed.length) {
        arr = parsed;
        break outer;
      }
      errors.push(`${tag}: no parseable results`);
    }
  }

  if (!arr || !arr.length) {
    return {
      configured: true,
      listings: [],
      error: errors.join(" | ").slice(0, 300) || "Gemini returned no results.",
    };
  }

  const listings = arr.map((x, i) => ({
    id: `gcc-${hash((x.company || "") + (x.role || "") + i)}`,
    trackId: "gcc",
    role: x.role || "AI / Software roles",
    company: x.company || "GCC",
    companySize: "",
    salary: "",
    platform: "gemini",
    sourceLabel: "Gemini · grounded",
    url: x.careersUrl || "#",
    location: "India" + (x.city ? ` · ${x.city}` : ""),
    contact: x.contact || "",
    lead: "hot",
    postedSec: 1,
    status: "open",
    viewed: false,
  }));

  const result = { configured: true, listings };
  cache = { at: Date.now(), data: result };
  return result;
}

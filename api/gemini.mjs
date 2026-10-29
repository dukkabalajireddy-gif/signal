// Gemini-powered discovery (GCCs and startups).
//
// Finds companies hiring AI & software talent in India, with a careers page and
// any PUBLIC talent-acquisition contact — each meant to be verified via the
// careers link. Reads the key from env (set it in Vercel). Without a key it
// returns { configured: false } so the UI can show a setup message.

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

const SHAPE = `For each, return a JSON object:
{"company": string, "city": string (an Indian city where they hire), "role": string (a representative AI/ML or software role), "careersUrl": string (their India careers/jobs page URL), "contact": string (a PUBLIC talent-acquisition / founder / recruiter email or page URL if known, else "")}
Return ONLY a JSON array of these objects.`;

const PROMPTS = {
  gcc: `List 12 to 15 Global Capability Centers (GCCs) or global companies' India offices (captive centers) that hire AI/ML and software engineering talent in India. Prefer ones actively hiring right now.
${SHAPE}`,
  startup: `List 12 to 15 EARLY-STAGE STARTUPS in India (roughly 20 to 50 employees, seed to Series A) that are actively hiring software / AI engineering talent and would likely be open to hiring fresh tier-1 college graduates (IIT, NIT, BITS, Manipal). Prefer well-known, recently funded Indian startups.
${SHAPE}`,
};

async function callModel(model, key, prompt, useSearch) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: useSearch
      ? { temperature: 0.6 }
      : { temperature: 0.5, responseMimeType: "application/json" },
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

const cache = {}; // keyed by type → { at, data }

export async function discover(type, fresh = false) {
  const key = apiKey();
  if (!key) return { configured: false, listings: [] };
  const prompt = PROMPTS[type] || PROMPTS.gcc;
  if (!fresh && cache[type] && Date.now() - cache[type].at < 60 * 60000) return cache[type].data;

  const errors = [];
  let arr = null;
  outer: for (const useSearch of [true, false]) {
    for (const model of MODELS) {
      const res = await callModel(model, key, prompt, useSearch);
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
    id: `${type}-${hash((x.company || "") + (x.role || "") + i)}`,
    trackId: type,
    role: x.role || "AI / Software roles",
    company: x.company || (type === "startup" ? "Startup" : "GCC"),
    companySize: type === "startup" ? "~20–50" : "",
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
  cache[type] = { at: Date.now(), data: result };
  return result;
}

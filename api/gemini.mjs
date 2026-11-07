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
{"company": string, "city": string (an Indian city where they hire), "role": string (a representative role they are hiring for), "size": string (approx headcount band, e.g. "80–150"), "package": string (approx annual CTC range in INR for 2–5 yrs experience, e.g. "₹12–25 LPA"), "careersUrl": string (their India careers/jobs page URL), "contact": string (a PUBLIC talent-acquisition / founder / recruiter email or page URL if known, else "")}
Return ONLY a JSON array of these objects.`;

const PROMPTS = {
  gcc: `List 12 to 15 Global Capability Centers (GCCs) or global companies' India offices (captive centers) that hire AI/ML and software engineering talent in India. Prefer ones actively hiring right now.
${SHAPE}`,
  // BabbleBots.ai's ICP: India-based startups / small-mid companies (NOT big
  // MNCs or GCCs) with ~30–200 people, doing well, hiring tier-1 grads for core
  // tech roles at ₹8 LPA and above.
  startup: `List 12 to 15 INDIAN startups or small/mid companies that are ACTIVELY HIRING and fit this EXACT profile:
- Headquartered in India (any city — Bangalore, Hyderabad, Pune, Delhi NCR, Chennai, Mumbai, Ahmedabad, Kochi, Jaipur, etc.). An Indian company — NOT a global MNC, NOT an IT-services giant, NOT a GCC / captive center.
- Roughly 30 to 200 employees (early to growth stage, seed to Series B). Prefer startups that are clearly doing well — recently funded, or revenue-generating and growing.
- Hiring for roles like Full Stack Engineer, Backend Engineer, Front-end Engineer, AI Engineer, AI Product Manager / AI Product Developer, Forward Deployed Engineer, or Software Engineering Intern.
- Able to offer competitive pay for 2–5 years of experience: roughly ₹8 LPA and above, up to ₹30–40 LPA for strong candidates.
STRICTLY EXCLUDE large enterprises, unicorns over ~1000 people, IT-services firms, and GCCs (e.g. Databricks, IBM, Cognizant, Infosys, TCS, Wipro, Accenture, Capgemini, Oracle). Prefer genuinely small, recently-funded Indian startups that hire fresh tier-1 (IIT/NIT/BITS/Manipal) talent.
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
  // Try plain JSON generation first (generous free quota), then grounded
  // Google Search as a fallback (its free quota is much smaller and is what
  // tends to 429 on the free tier).
  outer: for (const useSearch of [false, true]) {
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
    const why = errors.join(" | ").slice(0, 300) || "Gemini returned no results.";
    // If we have previously discovered results (e.g. quota hit this time),
    // keep serving them with the error attached rather than going blank.
    if (cache[type]?.data?.listings?.length) {
      return { ...cache[type].data, error: why };
    }
    return { configured: true, listings: [], error: why };
  }

  const listings = arr.map((x, i) => ({
    id: `${type}-${hash((x.company || "") + (x.role || "") + i)}`,
    trackId: type,
    role: x.role || "AI / Software roles",
    company: x.company || (type === "startup" ? "Startup" : "GCC"),
    companySize: x.size || (type === "startup" ? "~30–200" : ""),
    salary: x.package || "",
    platform: "gemini",
    sourceLabel: "Gemini · discovery",
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

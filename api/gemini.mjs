// Gemini-powered GCC discovery.
//
// Uses the Gemini API (free tier via Google AI Studio) with Google Search
// grounding to find Global Capability Centers / global companies' India
// offices that are actively hiring, plus a careers page and any PUBLIC
// talent-acquisition contact — each meant to be verified via the careers link.
//
// Reads the key from process.env.GEMINI_API_KEY (set it in Vercel). Without a
// key it returns { configured: false } so the UI can show a setup message.

const MODEL = "gemini-2.5-flash";

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

let cache = { at: 0, data: null };

export async function discoverGCCs(fresh = false) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { configured: false, listings: [] };
  if (!fresh && cache.data && Date.now() - cache.at < 60 * 60000) return cache.data;

  const prompt = `List 14 Global Capability Centers (GCCs) or global companies' India offices (captive centers) that are ACTIVELY hiring software or AI engineering talent in India right now.
Prefer ones where a direct talent-acquisition / recruiter contact can be found.
Return ONLY a JSON array, each item:
{"company": string, "city": string (Indian city), "role": string (an example open engineering role), "careersUrl": string (the India careers/jobs page URL), "contact": string (a PUBLIC talent-acquisition email or recruiter page URL if available, else "")}
No prose, no markdown fences — just the JSON array.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.4 },
  };

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  const j = await r.json();
  if (!r.ok) return { configured: true, error: j?.error?.message || `Gemini ${r.status}`, listings: [] };

  const text = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const match = text.match(/\[[\s\S]*\]/);
  let arr = [];
  try {
    arr = JSON.parse(match ? match[0] : text);
  } catch {
    arr = [];
  }

  const listings = (Array.isArray(arr) ? arr : []).map((x, i) => ({
    id: `gcc-${hash((x.company || "") + (x.role || "") + i)}`,
    trackId: "gcc",
    role: x.role || "Software / AI roles",
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

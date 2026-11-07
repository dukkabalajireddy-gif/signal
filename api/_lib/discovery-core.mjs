// Shared discovery helpers: ICP prompts, JSON extraction, and the mapping from
// a discovery JSON object to the frontend Listing shape. Engine-agnostic so the
// Groq discovery path (and any future engine) produces identical cards.

export function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function extractArray(text) {
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

export const PROMPTS = {
  gcc: `List 12 to 15 Global Capability Centers (GCCs) or global companies' India offices (captive centers) that hire AI/ML and software engineering talent in India. Prefer ones actively hiring right now.
${SHAPE}`,
  // BabbleBots.ai's ICP: India-based startups / small-mid companies (NOT big
  // MNCs or GCCs) with ~30–200 people, doing well, hiring tier-1 grads for core
  // tech roles at ₹8 LPA and above.
  startup: `List 12 to 15 INDIAN startups or small/mid companies that are ACTIVELY HIRING and fit this EXACT profile:
- Headquartered in India (any city — Bangalore, Hyderabad, Pune, Delhi NCR, Chennai, Mumbai, Ahmedabad, Kochi, Jaipur, etc.). An Indian company — NOT a global MNC, NOT an IT-services giant, NOT a GCC / captive center.
- Roughly 30 to 200 employees (early to growth stage, seed to Series B). Prefer startups that are clearly doing well — recently funded, or revenue-generating and growing. Y Combinator / Accel / Sequoia / Blume / Lightspeed / Peak XV-backed Indian startups are great picks.
- Hiring for roles like Full Stack Engineer, Backend Engineer, Front-end Engineer, AI Engineer, AI Product Manager / AI Product Developer, Forward Deployed Engineer, or Software Engineering Intern.
- Able to offer competitive pay for 2–5 years of experience: roughly ₹8 LPA and above, up to ₹30–40 LPA for strong candidates.
STRICTLY EXCLUDE large enterprises, unicorns over ~1000 people, IT-services firms, and GCCs (e.g. Databricks, IBM, Cognizant, Infosys, TCS, Wipro, Accenture, Capgemini, Oracle). Prefer genuinely small, recently-funded Indian startups that hire fresh tier-1 (IIT/NIT/BITS/Manipal) talent.
${SHAPE}`,
};

// Shared mapping: discovery JSON objects → frontend Listing shape.
export function mapDiscovery(type, arr, sourceLabel = "Discovery") {
  return arr.map((x, i) => ({
    id: `${type}-${hash((x.company || "") + (x.role || "") + i)}`,
    trackId: type,
    role: x.role || "AI / Software roles",
    company: x.company || (type === "startup" ? "Startup" : "GCC"),
    companySize: x.size || (type === "startup" ? "~30–200" : ""),
    salary: x.package || "",
    platform: "gemini", // kept for PLATFORM_META dot color; label says the engine
    sourceLabel,
    url: x.careersUrl || "#",
    location: "India" + (x.city ? ` · ${x.city}` : ""),
    contact: x.contact || "",
    lead: "hot",
    postedSec: 1,
    status: "open",
    viewed: false,
  }));
}

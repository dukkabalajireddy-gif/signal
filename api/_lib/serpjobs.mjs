// SerpAPI → Google Jobs source for Signal.
//
// Google Jobs indexes postings from LinkedIn, Wellfound, Indeed, Naukri and
// company sites, so this brings a FRESH, varied stream of Indian jobs — many
// of them smaller/startup employers that have no scrapable job board — which
// the keyless ATS sources never surface.
//
// Budget guard: the free SerpAPI tier is ~250 searches/month. We run a small
// fixed set of India queries and cache the result for 12h, IGNORING the
// Refresh button (Google Jobs data barely moves hour to hour), plus an
// in-flight guard so concurrent track loads share one fetch. So we spend at
// most ~N queries per 12h per running instance. Reads SERPAPI_KEY from env.

function apiKey() {
  return process.env.SERPAPI_KEY || process.env.SERP_API_KEY || process.env.Serpapi_signal || "";
}

export function serpConfigured() {
  return !!apiKey();
}

// ICP-leaning queries: India + core tech roles, biased toward startups.
const QUERIES = [
  "software engineer OR developer India startup",
  "AI engineer OR machine learning engineer India",
  "full stack OR backend OR frontend engineer India",
  "forward deployed engineer OR solutions engineer OR software intern India",
];

const INDIA = /\b(india|bengaluru|bangalore|mumbai|new delhi|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|kolkata|ahmedabad|kochi|coimbatore|jaipur|indore|chandigarh|remote)\b/i;

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// Google Jobs gives relative ages like "3 days ago" — turn into an epoch ms.
function postedMsFrom(rel) {
  if (!rel) return Date.now() - 3 * 86400000;
  const m = String(rel).match(/(\d+)\s*(minute|hour|day|week|month)/i);
  if (!m) return Date.now() - 3 * 86400000;
  const mult = { minute: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 }[m[2].toLowerCase()] || 86400000;
  return Date.now() - Number(m[1]) * mult;
}

let pool = { at: 0, items: [] };
let inFlight = null;
const TTL = 12 * 60 * 60 * 1000;

async function fetchQuery(q, key) {
  const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(q)}&gl=in&hl=en&api_key=${key}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return Array.isArray(j?.jobs_results) ? j.jobs_results : [];
}

function toRaw(job) {
  const company = (job.company_name || "").trim();
  const title = (job.title || "").trim();
  if (!company || !title) return null;
  const ext = job.detected_extensions || {};
  const via = (job.via || "").replace(/^via\s+/i, "").trim();
  const loc = job.location || "India";
  const apply = job.apply_options?.find((a) => a && a.link)?.link || job.share_link || "#";
  const desc = (job.description || "").slice(0, 300);
  return {
    company,
    role: title,
    loc,
    url: apply, // direct apply link (LinkedIn / Wellfound / company site)
    source: "serp",
    sourceLabel: via ? `via ${via}` : "Google Jobs",
    posted: new Date(postedMsFrom(ext.posted_at)).toISOString(),
    salary: ext.salary || "",
    matchText: `${title} ${desc}`,
    india: INDIA.test(loc) && !/\bremote\b/i.test(loc),
  };
}

// Returns raw-shaped items (same shape the other sources produce). Cached 12h.
export async function fromSerp() {
  const key = apiKey();
  if (!key) return [];
  if (pool.items.length && Date.now() - pool.at < TTL) return pool.items;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const seen = new Set();
      const items = [];
      for (const q of QUERIES) {
        let jobs = [];
        try {
          jobs = await fetchQuery(q, key);
        } catch {
          continue; // one bad query shouldn't sink the rest
        }
        for (const job of jobs) {
          const raw = toRaw(job);
          if (!raw) continue;
          const id = hash(raw.company + "|" + raw.role + "|" + raw.loc);
          if (seen.has(id)) continue;
          seen.add(id);
          items.push(raw);
        }
      }
      if (items.length) pool = { at: Date.now(), items };
      return pool.items;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

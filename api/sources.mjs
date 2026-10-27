// Live source fetcher for Signal.
//
// Pulls real postings from keyless sources (public ATS APIs, Hacker News,
// RemoteOK), filters to a track + India/remote, and returns objects in the
// frontend's Listing shape. Used by both the Vercel function (api/signals.js)
// and the local Vite dev middleware (vite.config.ts).

const UA = { "User-Agent": "Mozilla/5.0 (compatible; SignalBot/0.1)" };

async function getJSON(url, ms = 11000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── track + region classifiers ───────────────────────────────────────────────
export const LIVE_TRACKS = {
  "forward-deployed": { name: "Forward Deployed Engineer", match: (t) => /forward[\s-]?deployed/i.test(t) },
  "ai-engineer": {
    name: "AI Engineer",
    match: (t) =>
      /\b(ai|ml|genai|gen ai|generative ai|llm|machine learning|deep learning|applied (ai|ml)|nlp|ai\/ml)\b[^.]*\bengineer\b/i.test(t) ||
      /\bengineer\b[^.]*\b(ai|ml|llm|machine learning|generative ai)\b/i.test(t) ||
      /\b(ai|ml|machine learning) engineer\b/i.test(t),
  },
};

const INDIA = /\b(india|bengaluru|bangalore|mumbai|new delhi|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|kolkata|ahmedabad|remote[- ]?india)\b/i;
const REMOTE = /\b(remote|anywhere|worldwide|distributed|work from home|wfh|global)\b/i;

const regionOf = (s) => (INDIA.test(s || "") ? "india" : REMOTE.test(s || "") ? "remote" : null);
const strip = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();

const PRETTY = {
  databricks: "Databricks", anthropic: "Anthropic", gitlab: "GitLab", scaleai: "Scale AI",
  mongodb: "MongoDB", hashicorp: "HashiCorp", browserstack: "BrowserStack", razorpaysoftwares: "Razorpay",
  openai: "OpenAI", posthog: "PostHog", observeai: "Observe.AI", baseten: "Baseten", phonepe: "PhonePe",
  cred: "CRED", meesho: "Meesho", groww: "Groww", sarvam: "Sarvam AI", hasura: "Hasura",
  innovaccer: "Innovaccer", druva: "Druva", chargebee: "Chargebee", mindtickle: "Mindtickle",
  whatfix: "Whatfix", gupshup: "Gupshup", postman: "Postman", retool: "Retool", ramp: "Ramp",
  confluent: "Confluent", notion: "Notion", linear: "Linear", vanta: "Vanta", mercury: "Mercury",
  deel: "Deel", replit: "Replit", perplexity: "Perplexity", harvey: "Harvey", glean: "Glean",
  writer: "Writer", cresta: "Cresta", sierra: "Sierra", decagon: "Decagon", clay: "Clay", hex: "Hex",
};
const pretty = (s) => PRETTY[s] || s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ── sources ──────────────────────────────────────────────────────────────────
const GREENHOUSE = ["databricks","anthropic","gitlab","scaleai","mongodb","hashicorp","confluent","retool","ramp","razorpaysoftwares","postman","cred","meesho","phonepe","groww","sarvam","browserstack","hasura","innovaccer","druva","chargebee","mindtickle","whatfix","gupshup"];
const LEVER = ["huggingface","cohere","mistral","together","perplexity","voiceflow"];
const ASHBY = ["openai","ramp","notion","linear","vanta","clay","hex","mercury","deel","replit","perplexity","harvey","sierra","decagon","glean","writer","cresta","observeai","baseten","posthog"];

async function fromGreenhouse(token) {
  const d = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`);
  if (!d?.jobs) return [];
  return d.jobs.map((j) => ({ company: token, role: j.title, loc: j.location?.name || "", url: j.absolute_url, source: "greenhouse", posted: j.updated_at }));
}
async function fromLever(slug) {
  const d = await getJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(d)) return [];
  return d.map((j) => ({ company: slug, role: j.text, loc: j.categories?.location || "", url: j.hostedUrl, source: "lever", posted: j.createdAt }));
}
async function fromAshby(name) {
  const d = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${name}?includeCompensation=true`);
  if (!d?.jobs) return [];
  return d.jobs.map((j) => ({ company: name, role: j.title, loc: j.location || "", url: j.jobUrl, source: "ashby", posted: j.publishedAt, salary: j.compensation?.summaryComponents?.[0]?.summary || "" }));
}
async function fromRemoteOK() {
  const d = await getJSON("https://remoteok.com/api");
  if (!Array.isArray(d)) return [];
  return d.filter((j) => j.position).map((j) => ({
    company: j.company, role: j.position, loc: j.location || "Remote", url: j.url, source: "remoteok", posted: j.date,
    salary: j.salary_min ? `$${Math.round(j.salary_min / 1000)}k–${Math.round(j.salary_max / 1000)}k` : "", extra: (j.tags || []).join(" "),
  }));
}
async function fromHN() {
  const out = [];
  for (const q of ["forward deployed engineer", "AI engineer", "ML engineer"]) {
    const d = await getJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=40`);
    for (const h of d?.hits || []) {
      const text = strip(h.comment_text);
      const parts = text.split("|").map((s) => s.trim());
      if (parts.length < 3) continue; // keep only structured "Company | Role | …" posts
      out.push({ company: parts[0].slice(0, 36), role: parts[1].slice(0, 90), loc: text, url: `https://news.ycombinator.com/item?id=${h.objectID}`, source: "hackernews", posted: h.created_at });
    }
  }
  return out;
}

async function pool(items, fn, size = 12) {
  const res = [];
  for (let i = 0; i < items.length; i += size) res.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return res.flat();
}

// in-memory cache so two track calls share one fetch (and warm invocations are fast)
let cache = { at: 0, raw: null };
async function allRaw() {
  if (cache.raw && Date.now() - cache.at < 9 * 60000) return cache.raw;
  const [gh, lv, ash, rok, hn] = await Promise.all([
    pool(GREENHOUSE, fromGreenhouse), pool(LEVER, fromLever), pool(ASHBY, fromAshby), fromRemoteOK(), fromHN(),
  ]);
  cache = { at: Date.now(), raw: [...gh, ...lv, ...ash, ...rok, ...hn] };
  return cache.raw;
}

function leadOf(region, postedMs) {
  const ageDays = (Date.now() - (postedMs || Date.now())) / 86400000;
  if (region === "india") return ageDays < 21 ? "hot" : "warm";
  return ageDays < 21 ? "warm" : "cold";
}

// Returns listings for one live track, in the frontend's Listing shape.
export async function getListings(trackId, limit = 40) {
  const track = LIVE_TRACKS[trackId];
  if (!track) return [];
  const raw = await allRaw();
  const seen = new Set();
  const out = [];
  for (const r of raw) {
    if (!r.role || !track.match(r.role)) continue;
    const hay = r.source === "remoteok" ? `${r.loc} ${r.extra || ""}` : r.loc;
    const region = r.source === "remoteok" ? "remote" : regionOf(hay);
    if (!region) continue;
    const key = (r.company + "|" + r.role).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const postedMs = r.posted ? new Date(r.posted).getTime() : Date.now();
    out.push({
      id: `real-${hash(r.url || key)}`,
      trackId,
      role: r.role,
      company: pretty(r.company),
      companySize: "",
      salary: r.salary || "",
      platform: r.source,
      sourceLabel: { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", remoteok: "RemoteOK", hackernews: "Hacker News" }[r.source],
      url: r.url || "#",
      location: region === "india" ? "India" : "Remote",
      lead: leadOf(region, postedMs),
      postedSec: Math.max(1, Math.round((Date.now() - postedMs) / 1000)),
      status: "open",
      viewed: false,
    });
  }
  out.sort((a, b) => a.postedSec - b.postedSec);
  return out.slice(0, limit);
}

// Live source fetcher for Signal.
//
// Pulls real postings from keyless sources (public ATS APIs, Hacker News,
// RemoteOK, and Frontline Media's WordPress API), filters to a track +
// India/remote, sorts India-first, caps per company, and returns objects in
// the frontend's Listing shape. Used by both the Vercel function
// (api/signals.js) and the local Vite dev middleware (vite.config.ts).

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
const hasEng = (t) => /\b(engineer|developer|sde|programmer)\b/i.test(t);
export const LIVE_TRACKS = {
  "forward-deployed": { name: "Forward Deployed Engineer", match: (t) => /forward[\s-]?deployed/i.test(t) },
  "ai-engineer": {
    name: "AI Engineer",
    match: (t) =>
      /\b(ai|ml|genai|gen ai|generative ai|llm|machine learning|deep learning|applied (ai|ml)|nlp|ai\/ml)\b[^.]*\bengineer\b/i.test(t) ||
      /\bengineer\b[^.]*\b(ai|ml|llm|machine learning|generative ai)\b/i.test(t) ||
      /\b(ai|ml|machine learning) engineer\b/i.test(t),
  },
  "full-stack": { name: "Full Stack Engineer", match: (t) => /full[\s-]?stack/i.test(t) && hasEng(t) },
  "backend": { name: "Backend Engineer", match: (t) => /\bback[\s-]?end\b/i.test(t) && hasEng(t) },
  "frontend": { name: "Front-end Engineer", match: (t) => /\bfront[\s-]?end\b/i.test(t) && hasEng(t) },
  "india-tech": {
    name: "India Tech Hiring",
    indiaOnly: true,
    match: (t) =>
      /\b(engineer|developer|sde|programmer|software|data|analyst|devops|qa|architect|intern|ai|ml|python|java|full[\s-]?stack|back[\s-]?end|front[\s-]?end|tech|roles|fresher|walk[\s-]?in|hiring)\b/i.test(t),
  },
  "ai-pm": {
    name: "AI Product Manager",
    match: (t) => /\b(product manager|product lead|group product manager|principal pm|director of product|head of product)\b/i.test(t),
  },
  "gtm": {
    name: "GTM Engineer",
    match: (t) => /\b(gtm|go[\s-]?to[\s-]?market)\b/i.test(t) || /\b(growth|sales|solutions|revenue|deployment) engineer\b/i.test(t),
  },
  "intern": {
    name: "Software/AI Engineering Intern",
    match: (t) => /\b(intern|internship|fresher|graduate trainee|campus hire|entry[\s-]?level)\b/i.test(t),
  },
};

const INDIA = /\b(india|bengaluru|bangalore|mumbai|new delhi|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|kolkata|ahmedabad|remote[- ]?india)\b/i;
const REMOTE = /\b(remote|anywhere|worldwide|distributed|work from home|wfh|global)\b/i;

const regionOf = (s) => (INDIA.test(s || "") ? "india" : REMOTE.test(s || "") ? "remote" : null);
const strip = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();

const PRETTY = {
  databricks: "Databricks", anthropic: "Anthropic", gitlab: "GitLab", scaleai: "Scale AI", mongodb: "MongoDB",
  figma: "Figma", druva: "Druva", groww: "Groww", meesho: "Meesho", cred: "CRED", openai: "OpenAI",
  cursor: "Cursor", cognition: "Cognition", harvey: "Harvey", elevenlabs: "ElevenLabs", notion: "Notion",
  perplexity: "Perplexity", sierra: "Sierra", langchain: "LangChain", decagon: "Decagon", baseten: "Baseten",
  cohere: "Cohere", ramp: "Ramp", vanta: "Vanta", replit: "Replit", writer: "Writer", fireworks: "Fireworks AI",
  linear: "Linear", hex: "Hex", posthog: "PostHog", observeai: "Observe.AI",
  sigmoid: "Sigmoid", zeta: "Zeta", mindtickle: "Mindtickle", atlan: "Atlan",
};
const pretty = (s) => PRETTY[s] || s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ── sources (verified working boards) ────────────────────────────────────────
const GREENHOUSE = ["databricks", "mongodb", "gitlab", "druva", "groww", "sigmoid", "anthropic", "figma", "scaleai"];
const LEVER = ["meesho", "cred", "zeta", "mindtickle"];
const ASHBY = ["harvey", "openai", "cursor", "cognition", "elevenlabs", "notion", "perplexity", "sierra", "langchain", "decagon", "baseten", "cohere", "ramp", "vanta", "replit", "writer", "fireworks", "linear", "hex", "atlan"];
const FRONTLINE_CAT = 367;

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
    salary: j.salary_min ? `$${Math.round(j.salary_min / 1000)}k–${Math.round(j.salary_max / 1000)}k` : "", matchText: `${j.position} ${(j.tags || []).join(" ")}`,
  }));
}
async function fromHN() {
  const out = [];
  for (const q of ["forward deployed engineer", "AI engineer", "full stack engineer", "backend engineer"]) {
    const d = await getJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=40`);
    for (const h of d?.hits || []) {
      const text = strip(h.comment_text);
      const parts = text.split("|").map((s) => s.trim());
      if (parts.length < 3) continue;
      out.push({ company: parts[0].slice(0, 36), role: parts[1].slice(0, 90), loc: text, url: `https://news.ycombinator.com/item?id=${h.objectID}`, source: "hackernews", posted: h.created_at });
    }
  }
  return out;
}
// "NEC, Electronic arts and Cisco are hiring : ..." -> ["NEC","Electronic arts","Cisco"]
function parseFrontlineCompanies(title) {
  const head = (title.split(/\b(?:are hiring|is hiring|are now hiring|now hiring|hiring for|hiring|:)/i)[0] || "").trim();
  const parts = head
    .split(/,|\band\b|&/i)
    .map((s) => s.trim())
    .filter((p) => p.length >= 2 && p.length <= 40 && !/^(the|a|an|for|multiple|fresher|various|now|is|are|to)$/i.test(p));
  return parts.length ? parts.slice(0, 4) : [(head || title).slice(0, 40) || "India employer"];
}
async function fromFrontline() {
  const posts = await getJSON(`https://frontlinesmedia.in/wp-json/wp/v2/posts?categories=${FRONTLINE_CAT}&per_page=60&_fields=date,link,title,excerpt`);
  if (!Array.isArray(posts)) return [];
  const out = [];
  for (const p of posts) {
    const title = strip(p.title?.rendered || "");
    const excerpt = strip(p.excerpt?.rendered || "");
    for (const company of parseFrontlineCompanies(title)) {
      out.push({ company, role: title.slice(0, 95), loc: title, url: p.link, source: "frontline", posted: p.date, matchText: `${title} ${excerpt}`, india: true });
    }
  }
  return out;
}

async function pool(items, fn, size = 12) {
  const res = [];
  for (let i = 0; i < items.length; i += size) res.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return res.flat();
}

// in-memory cache so track calls share one fetch
let cache = { at: 0, raw: null };
async function allRaw(force = false) {
  if (!force && cache.raw && Date.now() - cache.at < 9 * 60000) return cache.raw;
  const [gh, lv, as, rok, hn, fl] = await Promise.all([
    pool(GREENHOUSE, fromGreenhouse), pool(LEVER, fromLever), pool(ASHBY, fromAshby), fromRemoteOK(), fromHN(), fromFrontline(),
  ]);
  cache = { at: Date.now(), raw: [...gh, ...lv, ...as, ...rok, ...hn, ...fl] };
  return cache.raw;
}

function leadOf(region, postedMs) {
  const ageDays = (Date.now() - (postedMs || Date.now())) / 86400000;
  if (region === "india") return ageDays < 21 ? "hot" : "warm";
  return ageDays < 21 ? "warm" : "cold";
}

const SOURCE_LABEL = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", remoteok: "RemoteOK", hackernews: "Hacker News", frontline: "Frontline Media" };

// Returns listings for one live track, India-first, capped per company.
export async function getListings(trackId, { limit = 60, perCompany = 5, fresh = false } = {}) {
  const track = LIVE_TRACKS[trackId];
  if (!track) return [];
  const raw = await allRaw(fresh);
  const seen = new Set();
  const matched = [];
  for (const r of raw) {
    const text = r.matchText || r.role || "";
    if (!track.match(text)) continue;
    const region = r.india ? "india" : r.source === "remoteok" ? "remote" : regionOf(`${r.loc} ${r.matchText || ""}`);
    if (!region) continue;
    if (track.indiaOnly && region !== "india") continue;
    const key = (r.company + "|" + r.role).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const postedMs = r.posted ? new Date(r.posted).getTime() : Date.now();
    matched.push({
      id: `real-${hash((r.url || "") + "|" + key)}`,
      trackId,
      role: r.role,
      company: pretty(r.company),
      companySize: "",
      salary: r.salary || "",
      platform: r.source,
      sourceLabel: SOURCE_LABEL[r.source],
      url: r.url || "#",
      location: region === "india" ? "India" : "Remote",
      lead: leadOf(region, postedMs),
      postedSec: Math.max(1, Math.round((Date.now() - postedMs) / 1000)),
      status: "open",
      viewed: false,
      _region: region,
    });
  }
  // India first, then most recent.
  matched.sort((a, b) => (a._region === "india" ? 0 : 1) - (b._region === "india" ? 0 : 1) || a.postedSec - b.postedSec);
  // Cap per company so one big board can't flood the track.
  const count = {};
  const out = [];
  for (const m of matched) {
    count[m.company] = (count[m.company] || 0) + 1;
    if (count[m.company] > perCompany) continue;
    const { _region, ...clean } = m;
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

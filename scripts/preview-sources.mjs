// Live preview: fetch real AI Engineer + Forward Deployed Engineer roles from
// keyless sources (public ATS APIs, Hacker News, RemoteOK), filtered to
// India-based or remote. Run: node scripts/preview-sources.mjs
//
// This is the proof-of-concept fetcher. Once the yield looks good, the same
// logic moves into a Vercel serverless function at /api/signals.

const UA = { "User-Agent": "Mozilla/5.0 (compatible; SignalBot/0.1)" };

async function getJSON(url, ms = 12000) {
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

// ── classifiers ──────────────────────────────────────────────────────────────
const TRACKS = {
  "Forward Deployed Engineer": (title) => /forward[\s-]?deployed/i.test(title),
  "AI Engineer": (title) =>
    /\b(ai|ml|a\.i\.|genai|gen ai|generative ai|llm|machine learning|deep learning|applied (ai|ml|scientist)|nlp|ai\/ml)\b[^.]*\bengineer\b/i.test(title) ||
    /\bengineer\b[^.]*\b(ai|ml|llm|machine learning|generative ai)\b/i.test(title) ||
    /\b(ai|ml|machine learning) engineer\b/i.test(title),
};

const INDIA = /\b(india|bengaluru|bangalore|mumbai|new delhi|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|kolkata|ahmedabad|remote[- ]?india)\b/i;
const REMOTE = /\b(remote|anywhere|worldwide|distributed|work from home|wfh|global)\b/i;

function regionOf(locText) {
  const s = locText || "";
  if (INDIA.test(s)) return "india";
  if (REMOTE.test(s)) return "remote";
  return null;
}

function classifyTrack(title) {
  for (const [name, fn] of Object.entries(TRACKS)) if (fn(title)) return name;
  return null;
}

const strip = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

// ── sources ──────────────────────────────────────────────────────────────────

// A curated list of companies known to hire AI/eng in India or remote and to
// use these ATSs. Wrong slugs simply return nothing and are skipped.
const GREENHOUSE = ["razorpaysoftwares","postman","cred","meesho","phonepe","groww","sarvam","browserstack","hasura","innovaccer","druva","chargebee","mindtickle","whatfix","gupshup","anthropic","databricks","scaleai","ramp","retool","gitlab","hashicorp","confluent","mongodb"];
const LEVER = ["huggingface","cohere","mistral","together","fireworks","perplexity","elevenlabs","runwayml","weaviate","voiceflow"];
const ASHBY = ["openai","ramp","notion","linear","vanta","clay","hex","mercury","deel","posthog","replit","perplexity","harvey","sierra","decagon","glean","writer","cresta","observeai","baseten"];

async function fromGreenhouse(token) {
  const d = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`);
  if (!d?.jobs) return [];
  return d.jobs.map((j) => ({
    company: token, role: j.title, location: j.location?.name || "", url: j.absolute_url,
    source: "Greenhouse", postedAt: j.updated_at,
  }));
}
async function fromLever(slug) {
  const d = await getJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(d)) return [];
  return d.map((j) => ({
    company: slug, role: j.text, location: j.categories?.location || "", url: j.hostedUrl,
    source: "Lever", postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : "",
  }));
}
async function fromAshby(name) {
  const d = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${name}?includeCompensation=true`);
  if (!d?.jobs) return [];
  return d.jobs.map((j) => ({
    company: name, role: j.title, location: j.location || j.address?.postalAddress?.addressLocality || "",
    url: j.jobUrl, source: "Ashby", postedAt: j.publishedAt || "",
    salary: j.compensation?.summaryComponents?.[0]?.summary || "",
  }));
}
async function fromRemoteOK() {
  const d = await getJSON("https://remoteok.com/api");
  if (!Array.isArray(d)) return [];
  return d.filter((j) => j.position).map((j) => ({
    company: j.company, role: j.position, location: j.location || "Remote",
    url: j.url, source: "RemoteOK", postedAt: j.date,
    salary: j.salary_min ? `$${Math.round(j.salary_min/1000)}k–${Math.round(j.salary_max/1000)}k` : "",
    extra: (j.tags || []).join(" "),
  }));
}
async function fromHN() {
  const out = [];
  for (const q of ["forward deployed engineer", "AI engineer", "ML engineer"]) {
    const d = await getJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=40`);
    for (const h of d?.hits || []) {
      const text = strip(h.comment_text);
      const firstLine = text.split("|").slice(0, 4).join(" | ");
      const parts = text.split("|").map((s) => s.trim());
      out.push({
        company: parts[0]?.slice(0, 40) || h.author, role: firstLine.slice(0, 90),
        location: text, url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: "HackerNews", postedAt: h.created_at, _fulltext: text,
      });
    }
  }
  return out;
}

// ── run ──────────────────────────────────────────────────────────────────────
async function pool(items, fn, size = 12) {
  const res = [];
  for (let i = 0; i < items.length; i += size) {
    res.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return res.flat();
}

(async () => {
  const t0 = Date.now();
  const [gh, lv, ash, rok, hn] = await Promise.all([
    pool(GREENHOUSE, fromGreenhouse),
    pool(LEVER, fromLever),
    pool(ASHBY, fromAshby),
    fromRemoteOK(),
    fromHN(),
  ]);
  const raw = [...gh, ...lv, ...ash, ...rok, ...hn];

  // Match track + region, dedupe.
  const seen = new Set();
  const matched = [];
  for (const r of raw) {
    const track = classifyTrack(r.role);
    if (!track) continue;
    const haystack = r.source === "HackerNews" ? r._fulltext : `${r.location} ${r.extra || ""}`;
    const region = r.source === "RemoteOK" ? "remote" : regionOf(haystack);
    if (!region) continue;
    const key = (r.company + "|" + r.role).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push({ ...r, track, region });
  }

  // Report
  const bySrc = {};
  for (const r of raw) bySrc[r.source] = (bySrc[r.source] || 0) + 1;
  console.log(`\nFetched ${raw.length} raw postings in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log("By source:", bySrc);

  for (const track of Object.keys(TRACKS)) {
    const list = matched.filter((m) => m.track === track);
    const india = list.filter((m) => m.region === "india").length;
    console.log(`\n═══ ${track} — ${list.length} India/remote matches (${india} India-based) ═══`);
    for (const m of list.slice(0, 10)) {
      const loc = m.region === "india" ? "IN" : "remote";
      console.log(`  • [${m.source}/${loc}] ${m.company} — ${m.role}${m.salary ? "  ("+m.salary+")" : ""}`);
      console.log(`      ${m.url}`);
    }
    if (!list.length) console.log("  (none)");
  }
})();

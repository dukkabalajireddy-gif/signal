// Recruiter-contact enrichment via Hunter.io Domain Search.
//
// Given a company name (and optional domain), ask Hunter for the people it has
// on that domain and return the best HR / recruiting contact — a real named
// person with their email — so BabbleBots can reach out. Reads the key from
// env (set HUNTER_API_KEY in Vercel). Without a key it returns
// { configured: false } so the UI can show a setup message.

function apiKey() {
  return process.env.HUNTER_API_KEY || process.env.Hunter_signal || process.env.HUNTER_KEY || "";
}

export function hunterConfigured() {
  return !!apiKey();
}

// Prefer people who actually own hiring. Lower number = better.
function rank(email) {
  const dept = (email.department || "").toLowerCase();
  const pos = (email.position || "").toLowerCase();
  const isRecruiting =
    dept === "hr" ||
    /recruit|talent|people|human resource|hiring|staffing/.test(dept + " " + pos);
  const isFounder = /founder|ceo|cofounder|co-founder|chief/.test(pos);
  // Recruiters first, then founders/leaders (useful at tiny startups), then rest.
  const bucket = isRecruiting ? 0 : isFounder ? 1 : 2;
  const conf = typeof email.confidence === "number" ? email.confidence : 0;
  return bucket * 1000 - conf; // within a bucket, higher confidence wins
}

function label(email) {
  const name = [email.first_name, email.last_name].filter(Boolean).join(" ").trim();
  const pos = (email.position || "").trim();
  if (name && pos) return `${name} · ${pos} · ${email.value}`;
  if (name) return `${name} · ${email.value}`;
  if (pos) return `${pos} · ${email.value}`;
  return email.value;
}

const cache = {}; // keyed by company/domain → { at, data }
const TTL = 24 * 60 * 60 * 1000; // a day; emails don't change often

export async function enrichCompany(company, domain = "", fresh = false) {
  const key = apiKey();
  if (!key) return { configured: false };
  const q = (domain || company || "").trim();
  if (!q) return { configured: true, error: "No company given." };

  const ck = q.toLowerCase();
  if (!fresh && cache[ck] && Date.now() - cache[ck].at < TTL) return cache[ck].data;

  const params = new URLSearchParams({ api_key: key, limit: "20" });
  if (domain) params.set("domain", domain);
  else params.set("company", company);

  let r, j;
  try {
    r = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    j = await r.json();
  } catch (e) {
    return { configured: true, error: String(e) };
  }
  if (!r.ok) {
    const msg = j?.errors?.[0]?.details || j?.errors?.[0]?.id || `HTTP ${r.status}`;
    return { configured: true, error: msg };
  }

  const emails = Array.isArray(j?.data?.emails) ? j.data.emails.filter((e) => e && e.value) : [];
  const resolvedDomain = j?.data?.domain || domain || "";
  if (!emails.length) {
    // Nothing public — a short-lived "none" so a retry later can still find one.
    const data = { configured: true, contact: "", domain: resolvedDomain, found: 0 };
    cache[ck] = { at: Date.now(), data };
    return data;
  }

  const best = emails.slice().sort((a, b) => rank(a) - rank(b))[0];
  const data = {
    configured: true,
    contact: label(best),
    email: best.value,
    name: [best.first_name, best.last_name].filter(Boolean).join(" ").trim(),
    position: best.position || "",
    department: best.department || "",
    confidence: best.confidence ?? null,
    domain: resolvedDomain,
    found: emails.length,
  };
  cache[ck] = { at: Date.now(), data };
  return data;
}

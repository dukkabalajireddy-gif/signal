// Resolve a Frontline / Job Alerts Hub post URL to the company's real apply /
// careers link, by fetching the post and extracting the external link (for
// Frontline, the "Apply Now" nearest the given company). Used by /api/go.

const UA = { "User-Agent": "Mozilla/5.0 (compatible; SignalBot/0.1)" };
const SOCIAL = /facebook|twitter|whatsapp|telegram|t\.me|wa\.me|instagram|youtube|gravatar|w\.org|gstatic|googleapis|google\.com|pinterest|linkedin\.com\/(share|sharing)|x\.com\/intent|\.(png|jpe?g|gif|svg|css|js)(\?|$)/i;
const ALLOWED = ["jobalertshub.com", "frontlinesmedia.in"];

export function allowedHost(url) {
  try {
    const h = new URL(url).hostname;
    return ALLOWED.some((a) => h === a || h.endsWith("." + a));
  } catch {
    return false;
  }
}

async function getText(url, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!r.ok) return "";
    return await r.text();
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function externalLinks(html, host) {
  const out = [];
  const re = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].replace(/&amp;/g, "&").replace(/&#0*38;/g, "&");
    if (href.includes(host) || SOCIAL.test(href)) continue;
    const txt = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    out.push({ href, txt, idx: m.index });
  }
  return out;
}

export async function resolveApply(url, company) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return url;
  }
  const html = await getText(url);
  if (!html) return url;
  const links = externalLinks(html, host);
  if (!links.length) return url;

  if (company) {
    const cl = company.toLowerCase();
    const applyish = links.filter((l) => /apply|click here|official|career/i.test(l.txt));
    const pool = applyish.length ? applyish : links;
    const near = pool.find((l) => html.slice(Math.max(0, l.idx - 400), l.idx).toLowerCase().includes(cl));
    if (near) return near.href;
    if (applyish.length) return applyish[0].href;
  }
  // Default (e.g. Job Alerts Hub single-company posts): first external link.
  return links[0].href;
}

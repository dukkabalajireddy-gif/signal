// Y Combinator startup directory as a source for Signal.
//
// Uses the community-maintained yc-oss open API (static JSON on GitHub Pages,
// refreshed daily) — specifically companies/hiring.json, the ~1500 YC companies
// currently hiring. No key, no scraping, nothing to rotate. We keep India-based
// startups with <=200 people (prime ICP: founder-led, fast to convert) and feed
// them into the Companies view.

const UA = { "User-Agent": "Mozilla/5.0 (compatible; SignalBot/0.1)" };
const SRC = "https://yc-oss.github.io/api/companies/hiring.json";
const MAX_TEAM = 200; // ICP: small startups, not unicorns
const INDIA = /\b(india|bengaluru|bangalore|mumbai|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida|kolkata|ahmedabad|kochi|coimbatore|jaipur|indore|chandigarh)\b/i;

let cache = { at: 0, items: [] };
const TTL = 6 * 60 * 60 * 1000; // the feed updates ~daily

export async function fromYC() {
  if (cache.items.length && Date.now() - cache.at < TTL) return cache.items;
  let list = [];
  try {
    const r = await fetch(SRC, { headers: UA });
    list = r.ok ? await r.json() : [];
  } catch {
    return cache.items; // keep any previous results on a blip
  }
  if (!Array.isArray(list)) return cache.items;

  const out = [];
  for (const h of list) {
    if (!h?.name || h.isHiring === false) continue;
    const regions = Array.isArray(h.regions) ? h.regions.join(" ") : "";
    const india = /india/i.test(regions) || INDIA.test(h.all_locations || "");
    if (!india) continue;
    if (h.team_size && h.team_size > MAX_TEAM) continue; // keep it to small startups
    const city = (h.all_locations || "").split(";").map((s) => s.trim()).find((s) => /india/i.test(s)) || "India";
    const oneLiner = (h.one_liner || "").slice(0, 70);
    out.push({
      company: h.name,
      role: oneLiner ? `Hiring · ${oneLiner}` : "Hiring — multiple roles",
      loc: city,
      url: h.slug ? `https://www.ycombinator.com/companies/${h.slug}/jobs` : h.website || h.url || "#",
      source: "yc",
      sourceLabel: `Y Combinator${h.batch ? ` · ${h.batch}` : ""}`,
      // isHiring is a CURRENT signal — stamp fresh so the per-track recency cut
      // doesn't bury these (launch date would).
      posted: new Date().toISOString(),
      companySize: h.team_size ? String(h.team_size) : "",
      // pad so these match the broad India-tech track and surface as leads
      matchText: `${h.name} ${h.one_liner || ""} software engineering hiring tech roles`,
      india: true,
    });
  }
  if (out.length) cache = { at: Date.now(), items: out };
  return cache.items;
}

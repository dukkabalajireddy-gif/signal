// Y Combinator startup directory as a source for Signal.
//
// YC's public company directory (ycombinator.com/companies) is powered by a
// public Algolia index with an `isHiring` flag, team size and location — ideal
// for finding small Indian YC startups that are hiring (prime ICP: founder-led,
// fast to convert, tier-1 friendly). The public search key is embedded in the
// directory page's `window.AlgoliaOpts`; we read it at runtime so key rotations
// self-heal. No account or env key needed.

const UA = { "User-Agent": "Mozilla/5.0 (compatible; SignalBot/0.1)" };
const INDEX = "YCCompany_production";
const MAX_TEAM = 200; // ICP: small startups, not unicorns

let creds = { at: 0, app: "", key: "" };

async function getCreds() {
  if (creds.app && creds.key && Date.now() - creds.at < 6 * 60 * 60 * 1000) return creds;
  try {
    const r = await fetch("https://www.ycombinator.com/companies?isHiring=true", { headers: UA });
    const html = r.ok ? await r.text() : "";
    const m = html.match(/window\.AlgoliaOpts\s*=\s*\{[^}]*?"app":"([^"]+)"[^}]*?"key":"([^"]+)"/);
    if (m) creds = { at: Date.now(), app: m[1], key: m[2] };
  } catch {
    /* keep any previous creds */
  }
  return creds;
}

export async function fromYC() {
  const { app, key } = await getCreds();
  if (!app || !key) return [];
  const body = {
    requests: [
      {
        indexName: INDEX,
        params:
          "facetFilters=" +
          encodeURIComponent('[["isHiring:true"],["regions:India"]]') +
          "&hitsPerPage=200",
      },
    ],
  };
  let j;
  try {
    const r = await fetch(
      `https://${app.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=${app}&x-algolia-api-key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "content-type": "application/json", ...UA }, body: JSON.stringify(body) },
    );
    j = await r.json();
  } catch {
    return [];
  }
  const hits = j?.results?.[0]?.hits || [];
  const out = [];
  for (const h of hits) {
    if (!h?.name) continue;
    if (h.team_size && h.team_size > MAX_TEAM) continue; // keep it to small startups
    const city = (h.all_locations || "").split(";").map((s) => s.trim()).find((s) => /india/i.test(s)) || "India";
    const oneLiner = (h.one_liner || "").slice(0, 70);
    out.push({
      company: h.name,
      role: oneLiner ? `Hiring · ${oneLiner}` : "Hiring — multiple roles",
      loc: city,
      url: h.slug ? `https://www.ycombinator.com/companies/${h.slug}/jobs` : h.website || "#",
      source: "yc",
      sourceLabel: `Y Combinator${h.batch ? ` · ${h.batch}` : ""}`,
      // isHiring is a CURRENT signal — stamp fresh so they aren't sorted out by
      // the per-track recency cut (launch date would bury them).
      posted: new Date().toISOString(),
      companySize: h.team_size ? String(h.team_size) : "",
      // ensure these match the broad India-tech track so they surface as leads
      matchText: `${h.name} ${h.one_liner || ""} software engineering hiring tech roles`,
      india: true,
    });
  }
  return out;
}

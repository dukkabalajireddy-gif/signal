// ─────────────────────────────────────────────────────────────────────────────
// Signal — seeded, convincing demo data (Wizard-of-Oz).
//
// The platform is HORIZONTAL and TRACK-based:
//   • A `Track` is a topic/keyword BabbleBots.ai monitors (e.g. "AI Engineer").
//   • Each track collects `Listing`s — demand signals scraped from the web
//     (job boards + social): a company looking for that role, with size, package,
//     source and a lead temperature.
//
// Everything here is SIMULATED for now. Replacing it with real scraped data is a
// data-layer swap: keep the `Track` / `Listing` shapes and feed them from live
// sources. Swap TRACKS below with BabbleBots.ai's real 9–12 track names.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform =
  | "naukri"
  | "linkedin"
  | "reddit"
  | "x"
  | "slack"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "remoteok"
  | "hackernews"
  | "frontline"
  | "jobalertshub"
  | "gemini";
export type Lead = "hot" | "warm" | "cold";
export type Status = "open" | "archived";

// Tracks that pull REAL live data from /api/signals. The rest stay simulated.
export const LIVE_TRACK_IDS = ["forward-deployed", "ai-engineer", "full-stack", "backend", "frontend", "india-tech", "ai-pm", "gtm", "intern", "gcc", "startup"] as const;

// These tracks use the Gemini-powered /api/discover endpoint instead of /api/signals.
export const GEMINI_TRACK_IDS = ["gcc", "startup"] as const;
export const isGeminiTrack = (id: string) => (GEMINI_TRACK_IDS as readonly string[]).includes(id);
export const isLiveTrack = (id: string) => (LIVE_TRACK_IDS as readonly string[]).includes(id);

export interface Track {
  id: string;
  name: string;
}

export interface Listing {
  id: string;
  trackId: string;
  role: string; // what they're looking for, e.g. "Senior AI Engineer"
  company: string;
  companySize: string; // headcount band, e.g. "500–1000"
  salary: string; // avg package for the role, e.g. "₹18–28 LPA"
  platform: Platform;
  sourceLabel: string; // "Naukri.com", "r/developersIndia", ...
  url: string; // original listing (demo → source homepage)
  location?: string; // "India" / "Remote" for live listings
  contact?: string; // public TA/recruiter contact (GCC discovery)
  lead: Lead;
  postedSec: number; // seconds since posted
  status: Status;
  viewed: boolean;
}

export const PLATFORM_META: Record<Platform, { label: string; dot: string }> = {
  naukri: { label: "Naukri.com", dot: "#4a7cff" },
  linkedin: { label: "LinkedIn", dot: "#4aa3ff" },
  reddit: { label: "Reddit", dot: "#ff6a3d" },
  x: { label: "X", dot: "#e9e9f4" },
  slack: { label: "Community", dot: "#c6f24e" },
  greenhouse: { label: "Greenhouse", dot: "#3bbf6f" },
  lever: { label: "Lever", dot: "#6b74ff" },
  ashby: { label: "Ashby", dot: "#a78bfa" },
  remoteok: { label: "RemoteOK", dot: "#c6f24e" },
  hackernews: { label: "Hacker News", dot: "#ff6600" },
  frontline: { label: "Frontline Media", dot: "#ff8a3d" },
  jobalertshub: { label: "Job Alerts Hub", dot: "#f0c04a" },
  gemini: { label: "Gemini", dot: "#8ab4f8" },
};

export const LEAD_META: Record<Lead, { label: string; fg: string; bg: string }> = {
  hot: { label: "Hot", fg: "#0b0b16", bg: "#c6f24e" },
  warm: { label: "Warm", fg: "#f5c451", bg: "rgba(245, 196, 81, 0.14)" },
  cold: { label: "Cold", fg: "#8fa6c6", bg: "rgba(143, 166, 198, 0.12)" },
};

// BabbleBots.ai's 8 tracks. The 9th grid cell is the "Add track" card.
export const TRACKS: Track[] = [
  { id: "forward-deployed", name: "Forward Deployed Engineer" },
  { id: "ai-engineer", name: "AI Engineer" },
  { id: "full-stack", name: "Full Stack Engineer" },
  { id: "backend", name: "Backend Engineer" },
  { id: "frontend", name: "Front-end Engineer" },
  { id: "intern", name: "Software/AI Engineering Intern" },
  { id: "ai-pm", name: "AI Product Manager" },
  { id: "gtm", name: "GTM Engineer" },
  { id: "india-tech", name: "India Tech Hiring" },
  { id: "gcc", name: "GCC Hiring · India" },
  { id: "startup", name: "Startup Hiring · India" },
];

const COMPANIES: [string, string][] = [
  ["Nurix AI", "11–50"],
  ["Sarvam AI", "51–200"],
  ["Observe.AI", "500–1000"],
  ["Fractal", "1000+"],
  ["Postman", "500–1000"],
  ["Razorpay", "1000+"],
  ["Yellow.ai", "201–500"],
  ["Mad Street Den", "51–200"],
  ["Uniphore", "500–1000"],
  ["CRED", "500–1000"],
  ["Hasura", "51–200"],
  ["Innovaccer", "1000+"],
  ["Darwinbox", "500–1000"],
  ["Zepto", "1000+"],
  ["Krutrim", "201–500"],
  ["Rephrase.ai", "11–50"],
];

const SALARY_BANDS = [
  "₹12–18 LPA",
  "₹18–28 LPA",
  "₹24–36 LPA",
  "₹30–45 LPA",
  "₹40–60 LPA",
  "₹55–80 LPA",
];
const STIPENDS = ["₹25–40k/mo", "₹40–60k/mo", "₹50–80k/mo"];
const SENIORITY = ["", "Senior ", "Lead ", "Founding ", "Staff "];
const isIntern = (name: string) => /intern/i.test(name);
const PLATFORMS: Platform[] = ["naukri", "linkedin", "reddit", "x", "slack"];
const LEADS: Lead[] = ["hot", "warm", "cold"];

function sourceLabel(p: Platform, company: string): string {
  switch (p) {
    case "naukri":
      return "Naukri.com";
    case "linkedin":
      return "LinkedIn";
    case "reddit":
      return "r/developersIndia";
    case "x":
      return "@" + company.toLowerCase().replace(/[^a-z0-9]/g, "") + "hq";
    case "slack":
      return "AI Hiring India #jobs";
    default:
      return PLATFORM_META[p].label;
  }
}

function sourceUrl(p: Platform): string {
  switch (p) {
    case "naukri":
      return "https://www.naukri.com";
    case "linkedin":
      return "https://www.linkedin.com/jobs";
    case "reddit":
      return "https://www.reddit.com/r/developersIndia";
    case "x":
      return "https://x.com/search";
    case "slack":
      return "#";
    default:
      return "#";
  }
}

let seedN = 0;
function makeListing(track: Track, i: number, ageBase: number): Listing {
  const ci = (track.name.length * 3 + i * 5) % COMPANIES.length;
  const [company, size] = COMPANIES[ci];
  const platform = PLATFORMS[(i + track.name.length) % PLATFORMS.length];
  const lead = LEADS[(i + ci) % LEADS.length];
  const intern = isIntern(track.name);
  const salary = intern
    ? STIPENDS[(i + ci) % STIPENDS.length]
    : SALARY_BANDS[(i + ci) % SALARY_BANDS.length];
  const role = intern ? track.name : SENIORITY[(i + ci) % SENIORITY.length] + track.name;
  return {
    id: `seed-${seedN++}`,
    trackId: track.id,
    role,
    company,
    companySize: size,
    salary,
    platform,
    sourceLabel: sourceLabel(platform, company),
    url: sourceUrl(platform),
    lead,
    postedSec: ageBase + i * 220 + ci * 31,
    status: "open",
    viewed: i > 1, // first couple are unread
  };
}

export const SEED_LISTINGS: Listing[] = TRACKS.flatMap((t, ti) =>
  Array.from({ length: 4 + (ti % 3) }, (_, i) => makeListing(t, i, 24 + ti * 9)),
);

// A fresh listing that streams in "live" for a given track.
let liveN = 0;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export function makeLiveListing(track: Track): Listing {
  const [company, size] = pick(COMPANIES);
  const platform = pick(PLATFORMS);
  const intern = isIntern(track.name);
  return {
    id: `live-${liveN++}`,
    trackId: track.id,
    role: intern ? track.name : pick(SENIORITY) + track.name,
    company,
    companySize: size,
    salary: intern ? pick(STIPENDS) : pick(SALARY_BANDS),
    platform,
    sourceLabel: sourceLabel(platform, company),
    url: sourceUrl(platform),
    lead: pick(LEADS),
    postedSec: 1,
    status: "open",
    viewed: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal — seeded, convincing demo data (Wizard-of-Oz).
// The platform is HORIZONTAL: everything is driven by `trackedKeywords`.
// AI-hiring is just the first demo configuration. Swap the keywords and the
// signal pool and the same UI tracks any topic across any source.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = "x" | "reddit" | "slack" | "linkedin";

export interface Signal {
  id: string;
  tag: string; // e.g. "COMPANY HIRING SIGNAL"
  match: number; // 0-100 relevance score
  author: string;
  handle: string; // @handle, r/sub, or community name
  platform: Platform;
  text: string;
  keywords: string[]; // substrings to highlight in `text`
  ageSec: number; // seconds since posted
  read: boolean;
}

export const PLATFORM_META: Record<Platform, { label: string; dot: string }> = {
  x: { label: "X", dot: "#e9e9f4" },
  reddit: { label: "Reddit", dot: "#ff6a3d" },
  slack: { label: "Community", dot: "#c6f24e" },
  linkedin: { label: "LinkedIn", dot: "#4aa3ff" },
};

export const DEFAULT_KEYWORDS = ["AI Engineer", "LLM", "AI agents", "Founding engineer"];

export const SOURCE_COUNT = 3;

// The feed shown on first load.
export const SEED_SIGNALS: Signal[] = [
  {
    id: "s1",
    tag: "COMPANY HIRING SIGNAL",
    match: 98,
    author: "Aditi Rao",
    handle: "@aditibuilds",
    platform: "x",
    text: "We're hiring a Founding ML Engineer to build our inference stack. Bengaluru, strong PyTorch + systems experience.",
    keywords: ["Founding ML Engineer", "inference"],
    ageSec: 12,
    read: false,
  },
  {
    id: "s2",
    tag: "DECISION-MAKER HIRING",
    match: 91,
    author: "datachai",
    handle: "r/developersIndia",
    platform: "reddit",
    text: "My team is looking for an AI Product Lead in Gurugram. ₹45–60 LPA, working directly with our LLM platform team.",
    keywords: ["AI Product Lead", "LLM"],
    ageSec: 64,
    read: false,
  },
  {
    id: "s3",
    tag: "NEW HIRING COMPANY",
    match: 86,
    author: "Rohan Mehta",
    handle: "The Product Folks #jobs",
    platform: "slack",
    text: "Quietly searching for a senior AI infrastructure engineer in Hyderabad. Must love developer tools and early-stage ambiguity.",
    keywords: ["AI infrastructure engineer"],
    ageSec: 182,
    read: false,
  },
  {
    id: "s4",
    tag: "TEAM EXPANSION DETECTED",
    match: 82,
    author: "Priya Kapoor",
    handle: "@priyakapoor",
    platform: "x",
    text: "Our Bengaluru research team is growing. Seeking an NLP researcher who has shipped real-world agents.",
    keywords: ["NLP researcher", "agents"],
    ageSec: 372,
    read: true,
  },
  {
    id: "s5",
    tag: "FOUNDER HIRING MENTION",
    match: 76,
    author: "latent_space_in",
    handle: "r/StartUpIndia",
    platform: "reddit",
    text: "Seed-stage Pune team needs its first AI engineer. Equity-heavy, India remote-friendly, moving very fast.",
    keywords: ["AI engineer"],
    ageSec: 548,
    read: true,
  },
];

// Pool of extra signals that stream in "live" to make the feed feel alive.
export const LIVE_POOL: Omit<Signal, "id" | "ageSec" | "read">[] = [
  {
    tag: "COMPANY HIRING SIGNAL",
    match: 94,
    author: "Kabir Shah",
    handle: "@kabirships",
    platform: "x",
    text: "Expanding our applied AI team in Mumbai — need someone strong on LLM evals and agent orchestration.",
    keywords: ["LLM", "agent"],
  },
  {
    tag: "DECISION-MAKER HIRING",
    match: 88,
    author: "buildspace_blr",
    handle: "r/developersIndia",
    platform: "reddit",
    text: "We're a fintech in Bengaluru hiring our first Founding engineer for an AI underwriting product. DMs open.",
    keywords: ["Founding engineer", "AI"],
  },
  {
    tag: "TEAM EXPANSION DETECTED",
    match: 79,
    author: "Neha Iyer",
    handle: "Generative AI India #hiring",
    platform: "slack",
    text: "Scaling the ML team in Chennai. Looking for an AI Engineer comfortable with RAG and production agents.",
    keywords: ["AI Engineer", "agents"],
  },
  {
    tag: "NEW HIRING COMPANY",
    match: 84,
    author: "Arjun Nair",
    handle: "@arjunbuilds",
    platform: "x",
    text: "Early team in Noida looking for an LLM engineer to own our retrieval + fine-tuning pipeline.",
    keywords: ["LLM"],
  },
  {
    tag: "FOUNDER HIRING MENTION",
    match: 81,
    author: "Sana Qureshi",
    handle: "linkedin.com/in/sana-q",
    platform: "linkedin",
    text: "We just raised our seed round and are hiring a Founding engineer for our AI agents platform. Remote India.",
    keywords: ["Founding engineer", "AI agents"],
  },
  {
    tag: "DECISION-MAKER HIRING",
    match: 90,
    author: "zeroshot_ai",
    handle: "r/MachineLearningIndia",
    platform: "reddit",
    text: "CTO here — hiring two AI Engineers in Pune for an on-device LLM project. Strong systems background a plus.",
    keywords: ["AI Engineer", "LLM"],
  },
];

export interface Spike {
  term: string;
  factor: string; // e.g. "3.4×"
  ageLabel: string; // e.g. "2m"
}

export const SPIKES: Spike[] = [
  { term: "AI agents", factor: "3.4×", ageLabel: "2m" },
  { term: "Founding engineer", factor: "2.1×", ageLabel: "8m" },
];

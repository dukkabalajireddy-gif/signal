import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_KEYWORDS,
  LIVE_POOL,
  PLATFORM_META,
  SEED_SIGNALS,
  SOURCE_COUNT,
  type Platform,
  type Signal,
} from "./data";

type View = "signals" | "pipeline" | "insights";
type Filter = "all" | "high" | "unread";

let idSeq = 1000;
const nextId = () => `live-${idSeq++}`;

function relTime(ageSec: number): string {
  if (ageSec < 60) return `${Math.max(1, Math.floor(ageSec))}s ago`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
  return `${Math.floor(ageSec / 3600)}h ago`;
}

function initials(name: string): string {
  const parts = name
    .replace(/^[@r]\//, "")
    .replace(/^@/, "")
    .split(/[\s_]+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "··";
}

// Wrap matched keywords in a lime highlight.
function Highlighted({ text, keywords }: { text: string; keywords: string[] }) {
  const escaped = keywords
    .filter(Boolean)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  if (!escaped.length) return <>{text}</>;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        escaped.some((k) => new RegExp(`^${k}$`, "i").test(part)) ? (
          <mark
            key={i}
            className="rounded-[3px] bg-lime/90 px-1 py-[1px] font-medium text-ink"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function PlatformDot({ platform }: { platform: Platform }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: PLATFORM_META[platform].dot }}
    />
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-lime">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 13h3l2.5-7 4 16 3-11 1.5 5H21"
            stroke="#0b0b16"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-[19px] font-semibold tracking-tight">BabbleBots.ai</span>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
        active ? "bg-panel-2 font-medium text-lime" : "text-muted hover:bg-panel-2/60 hover:text-text"
      }`}
      style={active ? { boxShadow: "inset 3px 0 0 var(--color-lime)" } : undefined}
    >
      <span className="w-4 text-center text-[15px]">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && (
        <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-medium text-muted">
          {badge}
        </span>
      )}
    </button>
  );
}

function Sidebar({
  view,
  setView,
  keywords,
  addKeyword,
  removeKeyword,
  pipelineCount,
}: {
  view: View;
  setView: (v: View) => void;
  keywords: string[];
  addKeyword: (k: string) => void;
  removeKeyword: (k: string) => void;
  pipelineCount: number;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const k = draft.trim();
    if (k) addKeyword(k);
    setDraft("");
  };
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-panel px-4 py-5 md:flex">
      <div className="px-1">
        <Logo />
      </div>

      <nav className="mt-7 space-y-1">
        <NavItem icon="📡" label="Client Signals" active={view === "signals"} onClick={() => setView("signals")} />
        <NavItem icon="▦" label="Pipeline" badge={pipelineCount} active={view === "pipeline"} onClick={() => setView("pipeline")} />
        <NavItem icon="✦" label="Insights" active={view === "insights"} onClick={() => setView("insights")} />
      </nav>

      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-faint">
            Roles to track
          </span>
          <span className="text-[11px] font-medium text-faint">{keywords.length}</span>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add a keyword"
            className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text placeholder:text-faint focus:border-lime/60 focus:outline-none"
          />
          <button
            onClick={submit}
            aria-label="Add keyword"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime text-lg font-semibold text-ink transition-transform hover:scale-105 active:scale-95"
          >
            +
          </button>
        </div>

        <div className="mt-3 space-y-1.5 overflow-y-auto">
          {keywords.map((k) => (
            <div
              key={k}
              className="group flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                {k}
              </span>
              <button
                onClick={() => removeKeyword(k)}
                aria-label={`Remove ${k}`}
                className="text-faint opacity-60 transition-opacity hover:text-text group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SignalCard({
  s,
  onRead,
  onDismiss,
}: {
  s: Signal;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const high = s.match >= 85;
  return (
    <article
      onClick={() => onRead(s.id)}
      className={`group relative cursor-pointer rounded-2xl border bg-card p-4 transition-colors hover:border-line/80 ${
        s.read ? "border-line/50" : "border-line"
      } ${high ? "pl-5" : ""}`}
      style={high ? { boxShadow: "inset 3px 0 0 var(--color-lime)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {!s.read && <span className="h-2 w-2 rounded-full bg-lime animate-pulse-dot" />}
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            {s.tag}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-lime">{s.match}% match</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(s.id);
            }}
            aria-label="Dismiss"
            className="text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel-2 text-[11px] font-semibold text-muted">
          {initials(s.author)}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
          <span className="font-medium text-text">{s.author}</span>
          <span className="flex items-center gap-1.5 text-muted">
            <PlatformDot platform={s.platform} />
            {s.handle}
          </span>
          <span className="text-faint">· {relTime(s.ageSec)}</span>
        </div>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-text/90">
        <Highlighted text={s.text} keywords={s.keywords} />
      </p>
    </article>
  );
}

function EmptyView({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-20 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-panel-2 text-2xl text-lime">
          ✦
        </div>
        <h2 className="mt-5 text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{note}</p>
        <span className="mt-4 inline-block rounded-full border border-line bg-card px-3 py-1 text-xs text-faint">
          Coming next
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("signals");
  const [keywords, setKeywords] = useState<string[]>(DEFAULT_KEYWORDS);
  const [signals, setSignals] = useState<Signal[]>(SEED_SIGNALS);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  // Age timestamps once a second.
  useEffect(() => {
    const t = setInterval(() => {
      setSignals((prev) => prev.map((s) => ({ ...s, ageSec: s.ageSec + 1 })));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Stream new signals in "live".
  const poolRef = useRef(0);
  useEffect(() => {
    const t = setInterval(() => {
      const base = LIVE_POOL[poolRef.current % LIVE_POOL.length];
      poolRef.current += 1;
      setSignals((prev) => [{ ...base, id: nextId(), ageSec: 1, read: false }, ...prev].slice(0, 40));
    }, 11000);
    return () => clearInterval(t);
  }, []);

  const addKeyword = (k: string) =>
    setKeywords((prev) => (prev.some((x) => x.toLowerCase() === k.toLowerCase()) ? prev : [...prev, k]));
  const removeKeyword = (k: string) => setKeywords((prev) => prev.filter((x) => x !== k));
  const markRead = (id: string) =>
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, read: true } : s)));
  const dismiss = (id: string) => setSignals((prev) => prev.filter((s) => s.id !== id));

  const counts = useMemo(
    () => ({
      all: signals.length,
      high: signals.filter((s) => s.match >= 85).length,
      unread: signals.filter((s) => !s.read).length,
    }),
    [signals],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return signals
      .filter((s) => (filter === "high" ? s.match >= 85 : filter === "unread" ? !s.read : true))
      .filter(
        (s) =>
          !q ||
          s.text.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q) ||
          s.handle.toLowerCase().includes(q),
      );
  }, [signals, filter, query]);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        view={view}
        setView={setView}
        keywords={keywords}
        addKeyword={addKeyword}
        removeKeyword={removeKeyword}
        pipelineCount={12}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {view !== "signals" ? (
          <EmptyView
            title={view === "pipeline" ? "Pipeline" : "Insights"}
            note={
              view === "pipeline"
                ? "Move the companies you care about through Spotted → Researching → Reached out → Replied. We'll wire this next."
                : "Trends, winning keywords and source breakdowns over time. We'll wire this next."
            }
          />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-6 py-8 xl:px-10">
            {/* header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-lime">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />
                  B2B Opportunities · India
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Potential Clients</h1>
                <p className="mt-1.5 max-w-md text-sm text-muted">
                  Companies showing active demand for AI talent across India.
                </p>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search signals"
                  className="w-56 rounded-xl border border-line bg-panel py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-faint focus:border-lime/60 focus:outline-none"
                />
              </div>
            </div>

            {/* sub-bar */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line pb-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="font-medium text-text">{SOURCE_COUNT}</span> Sources
              </span>
              <span className="text-muted">Last 24 hours ⌄</span>
              <div className="ml-auto flex items-center gap-4 text-xs text-faint">
                <span>Newest first</span>
              </div>
            </div>

            {/* filter tabs */}
            <div className="mt-3 flex items-center gap-5 text-sm">
              {(
                [
                  ["all", "All", counts.all],
                  ["high", "High relevance", counts.high],
                  ["unread", "Unread", counts.unread],
                ] as [Filter, string, number][]
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`relative pb-2 transition-colors ${
                    filter === id ? "font-medium text-text" : "text-muted hover:text-text"
                  }`}
                >
                  {label} <span className="text-faint">{n}</span>
                  {filter === id && (
                    <span className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-lime" />
                  )}
                </button>
              ))}
            </div>

            {/* feed */}
            <div className="mt-5 space-y-3 pb-10">
              {visible.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-sm text-muted">
                  No signals match this view yet. New ones stream in as they're detected.
                </div>
              ) : (
                visible.map((s) => (
                  <div key={s.id} className={s.id.startsWith("live-") ? "animate-signal-in" : ""}>
                    <SignalCard s={s} onRead={markRead} onDismiss={dismiss} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

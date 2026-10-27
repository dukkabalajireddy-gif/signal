import { useEffect, useMemo, useState } from "react";
import {
  LEAD_META,
  makeLiveListing,
  PLATFORM_META,
  SEED_LISTINGS,
  TRACKS,
  type Lead,
  type Listing,
  type Platform,
  type Track,
} from "./data";

type Nav = "signals" | "pipeline" | "insights";
type StatusTab = "open" | "archived";

function relTime(ageSec: number): string {
  if (ageSec < 60) return `${Math.max(1, Math.floor(ageSec))}s ago`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h ago`;
  return `${Math.floor(ageSec / 86400)}d ago`;
}

function PlatformDot({ platform }: { platform: Platform }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: PLATFORM_META[platform].dot }}
    />
  );
}

function LeadBadge({ lead }: { lead: Lead }) {
  const m = LEAD_META[lead];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: m.bg, color: m.fg }}
    >
      {lead === "hot" && <span>🔥</span>}
      {m.label}
    </span>
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
      <span className="text-[19px] font-semibold tracking-tight">Signal</span>
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
  nav,
  setNav,
  totalNew,
}: {
  nav: Nav;
  setNav: (n: Nav) => void;
  totalNew: number;
}) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-line bg-panel px-4 py-5 md:flex">
      <div className="px-1">
        <Logo />
      </div>

      <nav className="mt-7 space-y-1">
        <NavItem icon="📡" label="Client Signals" active={nav === "signals"} badge={totalNew || undefined} onClick={() => setNav("signals")} />
        <NavItem icon="▦" label="Pipeline" active={nav === "pipeline"} onClick={() => setNav("pipeline")} />
        <NavItem icon="✦" label="Insights" active={nav === "insights"} onClick={() => setNav("insights")} />
      </nav>

      <div className="mt-6 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-faint">
          Work in progress
        </span>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          Archive / viewed filters and saved views land here soon.
        </p>
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t border-line px-1 pt-3 text-[11px] text-faint">
        <span>for</span>
        <span className="font-medium text-muted">BabbleBots.ai</span>
      </div>
    </aside>
  );
}

// ─── Screen 1: Tracks grid ──────────────────────────────────────────────────

function TrackCard({
  track,
  openCount,
  newCount,
  sources,
  lastSec,
  onOpen,
}: {
  track: Track;
  openCount: number;
  newCount: number;
  sources: Platform[];
  lastSec: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 text-left transition-colors hover:border-lime/50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold leading-snug">{track.name}</span>
        {newCount > 0 && (
          <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-[11px] font-semibold text-ink">
            {newCount} new
          </span>
        )}
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <div className="font-mono text-2xl font-semibold leading-none">{openCount}</div>
          <div className="mt-1 text-xs text-muted">open signals</div>
        </div>
        <div className="flex items-center gap-1.5">
          {sources.map((p) => (
            <span key={p} title={PLATFORM_META[p].label}>
              <PlatformDot platform={p} />
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-faint">
        <span>{openCount > 0 ? `Updated ${relTime(lastSec)}` : "No signals yet"}</span>
        <span className="text-muted transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </button>
  );
}

function AddTrackCard() {
  return (
    <button
      className="flex h-full min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-muted transition-colors hover:border-lime/50 hover:text-text"
      title="Add track (coming soon)"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full border border-line text-xl">+</span>
      <span className="text-sm font-medium">Add track</span>
    </button>
  );
}

function TracksGrid({
  listings,
  onOpenTrack,
}: {
  listings: Listing[];
  onOpenTrack: (id: string) => void;
}) {
  const stats = useMemo(() => {
    const m = new Map<string, { open: number; neu: number; sources: Set<Platform>; last: number }>();
    for (const t of TRACKS) m.set(t.id, { open: 0, neu: 0, sources: new Set(), last: Infinity });
    for (const l of listings) {
      if (l.status !== "open") continue;
      const s = m.get(l.trackId);
      if (!s) continue;
      s.open += 1;
      if (!l.viewed) s.neu += 1;
      s.sources.add(l.platform);
      s.last = Math.min(s.last, l.postedSec);
    }
    return m;
  }, [listings]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-10">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-lime">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />
        B2B Opportunities · India
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tracks</h1>
      <p className="mt-1.5 text-sm text-muted">
        Topics BabbleBots.ai is monitoring across job boards and social. Open a track to see live demand signals.
      </p>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRACKS.map((t) => {
          const s = stats.get(t.id)!;
          return (
            <TrackCard
              key={t.id}
              track={t}
              openCount={s.open}
              newCount={s.neu}
              sources={[...s.sources].slice(0, 4)}
              lastSec={s.last === Infinity ? 0 : s.last}
              onOpen={() => onOpenTrack(t.id)}
            />
          );
        })}
        <AddTrackCard />
      </div>
    </div>
  );
}

// ─── Screen 2: Track detail ─────────────────────────────────────────────────

function ListingRow({
  l,
  onToggleArchive,
  onDelete,
}: {
  l: Listing;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {!l.viewed && <span className="h-2 w-2 rounded-full bg-lime animate-pulse-dot" />}
          <span className="font-medium text-text">{l.role}</span>
          <LeadBadge lead={l.lead} />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className="font-medium text-text/90">{l.company}</span>
          <span className="text-faint">·</span>
          <span>{l.companySize} employees</span>
          <span className="text-faint">·</span>
          <span className="font-medium text-lime">{l.salary}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
          <span className="flex items-center gap-1.5 text-muted">
            <PlatformDot platform={l.platform} />
            {l.sourceLabel}
          </span>
          <span>· {relTime(l.postedSec)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-lime px-3 py-1.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
        >
          Open ↗
        </a>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-text">
            <input
              type="checkbox"
              checked={l.status === "archived"}
              onChange={() => onToggleArchive(l.id)}
              className="h-3.5 w-3.5 accent-lime"
            />
            Archive
          </label>
          <button
            onClick={() => onDelete(l.id)}
            className="text-xs text-faint transition-colors hover:text-[#ff6a6a]"
            title="Delete (not relevant)"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function TrackDetail({
  track,
  listings,
  onBack,
  onToggleArchive,
  onDelete,
}: {
  track: Track;
  listings: Listing[];
  onBack: () => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [tab, setTab] = useState<StatusTab>("open");
  const [query, setQuery] = useState("");

  const mine = listings.filter((l) => l.trackId === track.id);
  const openCount = mine.filter((l) => l.status === "open").length;
  const archivedCount = mine.filter((l) => l.status === "archived").length;

  const visible = mine
    .filter((l) => l.status === tab)
    .filter((l) => {
      const q = query.trim().toLowerCase();
      return !q || l.company.toLowerCase().includes(q) || l.role.toLowerCase().includes(q);
    })
    .sort((a, b) => a.postedSec - b.postedSec);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 lg:px-10">
      {/* breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={onBack} className="text-muted transition-colors hover:text-text">
            Tracks
          </button>
          <span className="text-faint">›</span>
          <span className="font-medium text-text">{track.name}</span>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or role"
            className="w-56 rounded-xl border border-line bg-panel py-2 pl-9 pr-3 text-sm text-text placeholder:text-faint focus:border-lime/60 focus:outline-none"
          />
        </div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{track.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Companies showing active demand for this role across India.
      </p>

      {/* tabs */}
      <div className="mt-5 flex items-center gap-5 border-b border-line text-sm">
        {(
          [
            ["open", "Open", openCount],
            ["archived", "Archived", archivedCount],
          ] as [StatusTab, string, number][]
        ).map(([id, label, n]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative pb-2.5 transition-colors ${
              tab === id ? "font-medium text-text" : "text-muted hover:text-text"
            }`}
          >
            {label} <span className="text-faint">{n}</span>
            {tab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-lime" />}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="mt-5 space-y-3 pb-10">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-sm text-muted">
            {tab === "open"
              ? "No open signals here yet. New ones stream in as they're detected."
              : "Nothing archived yet. Archive a signal to park it here."}
          </div>
        ) : (
          visible.map((l) => (
            <div key={l.id} className={l.id.startsWith("live-") ? "animate-signal-in" : ""}>
              <ListingRow l={l} onToggleArchive={onToggleArchive} onDelete={onDelete} />
            </div>
          ))
        )}
      </div>
    </div>
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
  const [nav, setNav] = useState<Nav>("signals");
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>(SEED_LISTINGS);

  // Age timestamps.
  useEffect(() => {
    const t = setInterval(() => {
      setListings((prev) => prev.map((l) => ({ ...l, postedSec: l.postedSec + 1 })));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Stream new listings into random tracks.
  useEffect(() => {
    const t = setInterval(() => {
      const track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
      setListings((prev) => [makeLiveListing(track), ...prev].slice(0, 400));
    }, 9000);
    return () => clearInterval(t);
  }, []);

  const openTrack = (id: string) => {
    setActiveTrack(id);
    // Mark this track's open listings as viewed.
    setListings((prev) =>
      prev.map((l) => (l.trackId === id && l.status === "open" ? { ...l, viewed: true } : l)),
    );
  };
  const toggleArchive = (id: string) =>
    setListings((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: l.status === "archived" ? "open" : "archived" } : l,
      ),
    );
  const deleteListing = (id: string) => setListings((prev) => prev.filter((l) => l.id !== id));

  const totalNew = useMemo(
    () => listings.filter((l) => l.status === "open" && !l.viewed).length,
    [listings],
  );

  const track = activeTrack ? TRACKS.find((t) => t.id === activeTrack) ?? null : null;

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        nav={nav}
        setNav={(n) => {
          setNav(n);
          setActiveTrack(null);
        }}
        totalNew={totalNew}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {nav !== "signals" ? (
          <EmptyView
            title={nav === "pipeline" ? "Pipeline" : "Insights"}
            note={
              nav === "pipeline"
                ? "Move the companies you care about through Spotted → Researching → Reached out → Replied. We'll wire this next."
                : "Trends, winning tracks and source breakdowns over time. We'll wire this next."
            }
          />
        ) : track ? (
          <TrackDetail
            track={track}
            listings={listings}
            onBack={() => setActiveTrack(null)}
            onToggleArchive={toggleArchive}
            onDelete={deleteListing}
          />
        ) : (
          <TracksGrid listings={listings} onOpenTrack={openTrack} />
        )}
      </main>
    </div>
  );
}

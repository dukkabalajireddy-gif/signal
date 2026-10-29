import { useEffect, useMemo, useRef, useState } from "react";
import {
  isGeminiTrack,
  isLiveTrack,
  LEAD_META,
  LIVE_TRACK_IDS,
  makeLiveListing,
  PLATFORM_META,
  SEED_LISTINGS,
  STAGES,
  TRACKS,
  type Lead,
  type Listing,
  type PipelineItem,
  type Platform,
  type Stage,
  type Track,
} from "./data";

type TrackStatus = "loading" | "ok" | "error" | "unconfigured";
type LiveState = Record<string, TrackStatus>;

// Per-browser persistence for archive/delete decisions, so a reload keeps them.
const ARCH_KEY = "signal.archived.v1";
const DEL_KEY = "signal.deleted.v1";
const PIPE_KEY = "signal.pipeline.v1";
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* private mode / blocked storage — ignore */
  }
}

type Nav = "signals" | "pipeline" | "insights";
type StatusTab = "open" | "archived";

function relTime(ageSec: number): string {
  if (ageSec < 60) return `${Math.max(1, Math.floor(ageSec))}s ago`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h ago`;
  return `${Math.floor(ageSec / 86400)}d ago`;
}

function relTimeShort(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function RefreshButton({
  onClick,
  refreshing,
  lastFetched,
}: {
  onClick: () => void;
  refreshing?: boolean;
  lastFetched?: number | null;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={refreshing}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm text-text transition-colors hover:border-lime/50 disabled:opacity-60"
      >
        <span className={`inline-block ${refreshing ? "animate-spin" : ""}`}>↻</span>
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
      {lastFetched != null && !refreshing && (
        <span className="text-[11px] text-faint">Refreshed {relTimeShort(lastFetched)}</span>
      )}
    </div>
  );
}

function RemoteToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title="Show or hide remote (non-India) jobs"
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
        on ? "border-lime/50 text-text" : "border-line text-muted hover:text-text"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-lime" : "bg-faint"}`} />
      Remote {on ? "on" : "off"}
    </button>
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
  pipelineCount,
}: {
  nav: Nav;
  setNav: (n: Nav) => void;
  totalNew: number;
  pipelineCount: number;
}) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-line bg-panel px-4 py-5 md:flex">
      <div className="px-1">
        <Logo />
      </div>

      <nav className="mt-7 space-y-1">
        <NavItem icon="📡" label="Client Signals" active={nav === "signals"} badge={totalNew || undefined} onClick={() => setNav("signals")} />
        <NavItem icon="▦" label="Pipeline" active={nav === "pipeline"} badge={pipelineCount || undefined} onClick={() => setNav("pipeline")} />
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
  live,
  status,
  onOpen,
}: {
  track: Track;
  openCount: number;
  newCount: number;
  sources: Platform[];
  lastSec: number;
  live?: boolean;
  status?: TrackStatus;
  onOpen: () => void;
}) {
  const loading = live && status === "loading";
  const error = live && status === "error";
  const setup = live && status === "unconfigured";
  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 text-left transition-colors hover:border-lime/50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold leading-snug">{track.name}</span>
        {live ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-lime/40 px-2 py-0.5 text-[11px] font-semibold text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse-dot" />
            Live
          </span>
        ) : (
          newCount > 0 && (
            <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-[11px] font-semibold text-ink">
              {newCount} new
            </span>
          )
        )}
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <div className="font-mono text-2xl font-semibold leading-none">
            {loading ? "…" : error ? "—" : setup ? "⚙" : openCount}
          </div>
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
        <span>
          {loading
            ? "Fetching live signals…"
            : error
              ? "Couldn't load live data"
              : setup
                ? "Add Gemini key to enable"
                : openCount > 0
                  ? `Updated ${relTime(lastSec)}`
                  : "No signals yet"}
        </span>
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
  liveState,
  onOpenTrack,
  onRefresh,
  refreshing,
  lastFetched,
  remoteOn,
  onToggleRemote,
}: {
  listings: Listing[];
  liveState: LiveState;
  onOpenTrack: (id: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastFetched: number | null;
  remoteOn: boolean;
  onToggleRemote: () => void;
}) {
  const stats = useMemo(() => {
    const m = new Map<string, { open: number; neu: number; sources: Set<Platform>; last: number }>();
    for (const t of TRACKS) m.set(t.id, { open: 0, neu: 0, sources: new Set(), last: Infinity });
    for (const l of listings) {
      if (l.status !== "open") continue;
      if (!remoteOn && l.location === "Remote") continue;
      const s = m.get(l.trackId);
      if (!s) continue;
      s.open += 1;
      if (!l.viewed) s.neu += 1;
      s.sources.add(l.platform);
      s.last = Math.min(s.last, l.postedSec);
    }
    return m;
  }, [listings, remoteOn]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-lime">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />
            B2B Opportunities · India
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tracks</h1>
          <p className="mt-1.5 text-sm text-muted">
            Topics BabbleBots.ai is monitoring across job boards and social. Open a track to see live demand signals.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <RemoteToggle on={remoteOn} onToggle={onToggleRemote} />
          <RefreshButton onClick={onRefresh} refreshing={refreshing} lastFetched={lastFetched} />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRACKS.map((t) => {
          const s = stats.get(t.id)!;
          const live = isLiveTrack(t.id);
          return (
            <TrackCard
              key={t.id}
              track={t}
              openCount={s.open}
              newCount={s.neu}
              sources={[...s.sources].slice(0, 4)}
              lastSec={s.last === Infinity ? 0 : s.last}
              live={live}
              status={live ? liveState[t.id] : undefined}
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
  inPipeline,
  onAddToPipeline,
  onToggleArchive,
  onDelete,
}: {
  l: Listing;
  inPipeline?: boolean;
  onAddToPipeline?: (l: Listing) => void;
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
          {l.location && (
            <>
              <span className="text-faint">·</span>
              <span>{l.location}</span>
            </>
          )}
          {l.companySize && (
            <>
              <span className="text-faint">·</span>
              <span>{l.companySize} employees</span>
            </>
          )}
          {l.salary && (
            <>
              <span className="text-faint">·</span>
              <span className="font-medium text-lime">{l.salary}</span>
            </>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
          <span className="flex items-center gap-1.5 text-muted">
            <PlatformDot platform={l.platform} />
            {l.sourceLabel}
          </span>
          <span>· {relTime(l.postedSec)}</span>
        </div>

        {l.contact && (
          <div className="mt-1.5 text-xs">
            <span className="text-faint">Contact: </span>
            <span className="select-all font-medium text-lime">{l.contact}</span>
          </div>
        )}
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
        {onAddToPipeline && (
          <button
            onClick={() => onAddToPipeline(l)}
            disabled={inPipeline}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              inPipeline
                ? "cursor-default border-lime/40 text-lime"
                : "border-line text-text hover:border-lime/50"
            }`}
          >
            {inPipeline ? "✓ In pipeline" : "＋ Pipeline"}
          </button>
        )}
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
  open,
  archived,
  live,
  status,
  message,
  remoteOn,
  pipelineIds,
  onAddToPipeline,
  onBack,
  onRefresh,
  onToggleArchive,
  onDelete,
}: {
  track: Track;
  open: Listing[];
  archived: Listing[];
  live?: boolean;
  status?: TrackStatus;
  message?: string;
  remoteOn?: boolean;
  pipelineIds: Set<string>;
  onAddToPipeline: (l: Listing) => void;
  onBack: () => void;
  onRefresh: () => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isGemini = isGeminiTrack(track.id);
  const isStartup = track.id === "startup";
  const [tab, setTab] = useState<StatusTab>("open");
  const [query, setQuery] = useState("");

  const keepRemote = (l: Listing) => remoteOn || l.location !== "Remote";
  const openMine = open.filter((l) => l.trackId === track.id && keepRemote(l));
  const archivedMine = archived.filter((l) => l.trackId === track.id && keepRemote(l));
  const openCount = openMine.length;
  const archivedCount = archivedMine.length;

  const visible = (tab === "open" ? openMine : archivedMine)
    .filter((l) => {
      const q = query.trim().toLowerCase();
      return !q || l.company.toLowerCase().includes(q) || l.role.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const ai = a.location === "India" ? 0 : 1;
      const bi = b.location === "India" ? 0 : 1;
      return ai - bi || a.postedSec - b.postedSec;
    });

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 lg:px-10">
      {/* breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back to tracks"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-lime/50 hover:text-text"
          >
            <span className="text-base leading-none">←</span> Back
          </button>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={onBack} className="text-muted transition-colors hover:text-text">
              Tracks
            </button>
            <span className="text-faint">›</span>
            <span className="font-medium text-text">{track.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {live && (
            <button
              onClick={onRefresh}
              disabled={status === "loading"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-sm text-text transition-colors hover:border-lime/50 disabled:opacity-60"
            >
              <span className={`inline-block ${status === "loading" ? "animate-spin" : ""}`}>↻</span>
              {status === "loading" ? "…" : "Refresh"}
            </button>
          )}
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or role"
              className="w-48 rounded-xl border border-line bg-panel py-2 pl-9 pr-3 text-sm text-text placeholder:text-faint focus:border-lime/60 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{track.name}</h1>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/40 px-2.5 py-1 text-[11px] font-semibold text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse-dot" />
            {status === "loading"
              ? "Fetching…"
              : status === "error"
                ? "Live · error"
                : status === "unconfigured"
                  ? "Needs key"
                  : "Live"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {isGemini
          ? isStartup
            ? "Early-stage Indian startups (~20–50 people) hiring — a fit for fresh tier-1 talent, discovered via Gemini. Verify via the careers link."
            : "Global capability centers hiring in India, discovered via Gemini — verify each through its careers link."
          : live
            ? "Real openings pulled from job boards & communities — India-based or remote."
            : "Companies showing active demand for this role across India."}
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
            {message && tab === "open" && status !== "loading" ? (
              <span className="mx-auto block max-w-xl break-words text-faint">{message}</span>
            ) : live && status === "unconfigured" ? (
              "Add your GEMINI_API_KEY in Vercel (Settings → Environment Variables), then hit Refresh to discover GCCs."
            ) : live && status === "loading" ? (
              isGemini
                ? isStartup
                  ? "Asking Gemini for startups hiring in India…"
                  : "Asking Gemini for GCCs hiring in India…"
                : "Fetching live signals from job boards & communities…"
            ) : live && status === "error" ? (
              "Couldn't reach the live sources. Try again shortly."
            ) : tab === "open" ? (
              "No open signals here yet. New ones stream in as they're detected."
            ) : (
              "Nothing archived yet. Archive a signal to park it here."
            )}
          </div>
        ) : (
          visible.map((l) => (
            <div key={l.id} className={l.id.startsWith("live-") ? "animate-signal-in" : ""}>
              <ListingRow
                l={l}
                inPipeline={pipelineIds.has(l.id)}
                onAddToPipeline={onAddToPipeline}
                onToggleArchive={onToggleArchive}
                onDelete={onDelete}
              />
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

function PipelineCard({
  item,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onRemove,
}: {
  item: PipelineItem;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{item.company}</span>
        <button onClick={onRemove} aria-label="Remove from pipeline" className="shrink-0 text-faint hover:text-[#ff6a6a]">
          ✕
        </button>
      </div>
      <div className="mt-0.5 line-clamp-2 text-xs text-muted">{item.role}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
        <LeadBadge lead={item.lead} />
        {item.location && <span>{item.location}</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <button onClick={onPrev} disabled={!canPrev} title="Previous stage" className="rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:text-text disabled:opacity-30">
            ←
          </button>
          <button onClick={onNext} disabled={!canNext} title="Next stage" className="rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:text-text disabled:opacity-30">
            →
          </button>
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-lime hover:underline">
          Open ↗
        </a>
      </div>
      {item.contact && (
        <div className="mt-1.5 truncate text-[11px]">
          <span className="text-faint">Contact: </span>
          <span className="select-all text-lime">{item.contact}</span>
        </div>
      )}
    </div>
  );
}

function PipelineBoard({
  pipeline,
  onMove,
  onRemove,
  onGoTracks,
}: {
  pipeline: PipelineItem[];
  onMove: (id: string, stage: Stage) => void;
  onRemove: (id: string) => void;
  onGoTracks: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-lime">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />
        Conversion funnel
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pipeline</h1>
      <p className="mt-1.5 text-sm text-muted">
        Move leads from Spotted to Posted on BabbleBots. {pipeline.length} lead
        {pipeline.length === 1 ? "" : "s"}.
      </p>

      {pipeline.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
          No leads yet. Open a track and hit <span className="font-medium text-text">＋ Pipeline</span> on a lead to start.
          <div className="mt-4">
            <button onClick={onGoTracks} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm text-text transition-colors hover:border-lime/50">
              Go to tracks
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage, si) => {
            const items = pipeline.filter((p) => p.stage === stage.id);
            return (
              <div key={stage.id} className="flex w-[250px] shrink-0 flex-col">
                <div className="flex items-center justify-between rounded-t-xl border border-line bg-panel px-3 py-2.5">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="rounded-full bg-line px-2 py-0.5 text-[11px] text-muted">{items.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 rounded-b-xl border border-t-0 border-line bg-ink/40 p-2">
                  {items.length === 0 ? (
                    <div className="px-2 py-6 text-center text-xs text-faint">—</div>
                  ) : (
                    items.map((p) => (
                      <PipelineCard
                        key={p.id}
                        item={p}
                        canPrev={si > 0}
                        canNext={si < STAGES.length - 1}
                        onPrev={() => onMove(p.id, STAGES[si - 1].id)}
                        onNext={() => onMove(p.id, STAGES[si + 1].id)}
                        onRemove={() => onRemove(p.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [nav, setNav] = useState<Nav>("signals");
  const [activeTrack, setActiveTrack] = useState<string | null>(null);

  // Persisted archive (full items) + delete (ids), so reloads keep decisions.
  const deletedRef = useRef<Set<string>>(new Set(loadJSON<string[]>(DEL_KEY, [])));
  const archivedRef = useRef<Listing[]>(loadJSON<Listing[]>(ARCH_KEY, []));
  const [archived, setArchivedState] = useState<Listing[]>(archivedRef.current);
  const setArchived = (updater: (prev: Listing[]) => Listing[]) => {
    archivedRef.current = updater(archivedRef.current);
    setArchivedState(archivedRef.current);
    saveJSON(ARCH_KEY, archivedRef.current);
  };
  const isHidden = (id: string) =>
    deletedRef.current.has(id) || archivedRef.current.some((a) => a.id === id);

  // Pipeline (sales funnel), persisted per browser.
  const pipelineRef = useRef<PipelineItem[]>(loadJSON<PipelineItem[]>(PIPE_KEY, []));
  const [pipeline, setPipelineState] = useState<PipelineItem[]>(pipelineRef.current);
  const setPipeline = (updater: (prev: PipelineItem[]) => PipelineItem[]) => {
    pipelineRef.current = updater(pipelineRef.current);
    setPipelineState(pipelineRef.current);
    saveJSON(PIPE_KEY, pipelineRef.current);
  };
  const addToPipeline = (l: Listing) => {
    if (pipelineRef.current.some((p) => p.id === l.id)) return;
    setPipeline((prev) => [{ ...l, stage: "spotted" }, ...prev]);
  };
  const moveStage = (id: string, stage: Stage) =>
    setPipeline((prev) => prev.map((p) => (p.id === id ? { ...p, stage } : p)));
  const removeFromPipeline = (id: string) => setPipeline((prev) => prev.filter((p) => p.id !== id));

  const [listings, setListings] = useState<Listing[]>(() =>
    SEED_LISTINGS.filter((l) => !isLiveTrack(l.trackId)).filter((l) => !isHidden(l.id)),
  );
  const [liveState, setLiveState] = useState<LiveState>(() =>
    Object.fromEntries(LIVE_TRACK_IDS.map((id) => [id, "loading"])),
  );
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [remoteOn, setRemoteOn] = useState<boolean>(() => loadJSON<boolean>("signal.remoteOn", true));
  const toggleRemote = () =>
    setRemoteOn((v) => {
      const n = !v;
      saveJSON("signal.remoteOn", n);
      return n;
    });

  // Fetch one live track; `fresh` forces a re-scrape past the cache.
  const loadTrack = (id: string, fresh = false) => {
    setLiveState((s) => ({ ...s, [id]: "loading" }));
    const url = isGeminiTrack(id)
      ? `/api/discover?type=${id}${fresh ? "&fresh=1" : ""}`
      : `/api/signals?track=${id}${fresh ? "&fresh=1" : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.configured === false) {
          setLiveState((s) => ({ ...s, [id]: "unconfigured" }));
          return;
        }
        const fetched: Listing[] = (Array.isArray(data.listings) ? data.listings : []).filter(
          (l: Listing) => !isHidden(l.id),
        );
        setListings((prev) => [...prev.filter((l) => l.trackId !== id), ...fetched]);
        setLiveState((s) => ({ ...s, [id]: "ok" }));
        setLastFetched(Date.now());
        setMessages((m) => {
          const next = { ...m };
          if (data.error) next[id] = `Gemini error: ${data.error}`;
          else if (fetched.length === 0 && data.note) next[id] = `Gemini returned: ${data.note}`;
          else delete next[id];
          return next;
        });
      })
      .catch(() => setLiveState((s) => ({ ...s, [id]: "error" })));
  };
  const refreshAll = () => LIVE_TRACK_IDS.forEach((id) => loadTrack(id, true));

  // Initial load of all live tracks.
  useEffect(() => {
    LIVE_TRACK_IDS.forEach((id) => loadTrack(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Age timestamps.
  useEffect(() => {
    const t = setInterval(() => {
      setListings((prev) => prev.map((l) => ({ ...l, postedSec: l.postedSec + 1 })));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Stream simulated listings into the Wizard-of-Oz tracks only.
  useEffect(() => {
    const woz = TRACKS.filter((t) => !isLiveTrack(t.id));
    if (!woz.length) return;
    const t = setInterval(() => {
      const track = woz[Math.floor(Math.random() * woz.length)];
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
  const toggleArchive = (id: string) => {
    const inOpen = listings.find((l) => l.id === id);
    if (inOpen) {
      setListings((prev) => prev.filter((l) => l.id !== id));
      setArchived((prev) => [{ ...inOpen, status: "archived" }, ...prev]);
      return;
    }
    const inArchive = archivedRef.current.find((l) => l.id === id);
    if (inArchive) {
      setArchived((prev) => prev.filter((l) => l.id !== id));
      setListings((prev) => [{ ...inArchive, status: "open" }, ...prev]);
    }
  };
  const deleteListing = (id: string) => {
    deletedRef.current.add(id);
    saveJSON(DEL_KEY, [...deletedRef.current]);
    setListings((prev) => prev.filter((l) => l.id !== id));
    setArchived((prev) => prev.filter((l) => l.id !== id));
  };

  const totalNew = useMemo(
    () => listings.filter((l) => l.status === "open" && !l.viewed).length,
    [listings],
  );
  const pipelineIds = useMemo(() => new Set(pipeline.map((p) => p.id)), [pipeline]);

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
        pipelineCount={pipeline.length}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {nav === "pipeline" ? (
          <PipelineBoard
            pipeline={pipeline}
            onMove={moveStage}
            onRemove={removeFromPipeline}
            onGoTracks={() => setNav("signals")}
          />
        ) : nav === "insights" ? (
          <EmptyView
            title="Insights"
            note="Trends, winning tracks and source breakdowns over time. We'll wire this next."
          />
        ) : track ? (
          <TrackDetail
            track={track}
            open={listings}
            archived={archived}
            live={isLiveTrack(track.id)}
            status={liveState[track.id]}
            message={messages[track.id]}
            remoteOn={remoteOn}
            pipelineIds={pipelineIds}
            onAddToPipeline={addToPipeline}
            onBack={() => setActiveTrack(null)}
            onRefresh={() => loadTrack(track.id, true)}
            onToggleArchive={toggleArchive}
            onDelete={deleteListing}
          />
        ) : (
          <TracksGrid
            listings={listings}
            liveState={liveState}
            onOpenTrack={openTrack}
            onRefresh={refreshAll}
            refreshing={Object.values(liveState).some((v) => v === "loading")}
            lastFetched={lastFetched}
            remoteOn={remoteOn}
            onToggleRemote={toggleRemote}
          />
        )}
      </main>
    </div>
  );
}

import type { DemoKey } from "../../seed/types";

/** Output pane — a file/slide viewer. Matches the Paper "Tinker Workspace — Light"
 * right pane: TabStrip → FileHeader → ToolStrip → Viewport → ProgressStrip → ModeStrip.
 * All copy is placeholder; the user replaces it with seeded files. */

type Props = { demo: DemoKey };

const DOCS: Record<DemoKey, OutputDoc> = {
  whitespace: {
    filename: "marvell-whitespace-2026-04-22.md",
    filepath: "/vault/keysight-west/accounts/marvell/whitespace-2026-04-22.md",
    kind: "md",
    hero: "Marvell · Whitespace",
    subtitle: "Top 3 products to lead with",
    currentPage: 1,
    totalPages: 8,
  },
  enrichment: {
    filename: "prospects-enriched-2026-04-22.csv",
    filepath: "/vault/keysight-west/prospects/2026-04-22.csv",
    kind: "csv",
    hero: "Prospect Enrichment",
    subtitle: "8 rows · 8 columns · written today",
    currentPage: 1,
    totalPages: 1,
  },
  meeting: {
    filename: "orbion-anika-prep.md",
    filepath: "/vault/keysight-west/accounts/orbion-semi/prep-2026-04-22.md",
    kind: "md",
    hero: "Orbion · Anika prep",
    subtitle: "Pre-meeting brief + follow-up draft",
    currentPage: 1,
    totalPages: 4,
  },
};

type OutputDoc = {
  filename: string;
  filepath: string;
  kind: "md" | "csv" | "html";
  hero: string;
  subtitle: string;
  currentPage: number;
  totalPages: number;
};

export function OutputPane({ demo }: Props) {
  const doc = DOCS[demo];
  const modeLabel = doc.kind.toUpperCase();
  const progress = doc.currentPage / doc.totalPages;

  return (
    <section className="pane pane--output">
      <div className="ws-tabs" role="tablist">
        <button role="tab" aria-selected className="ws-tab ws-tab--active ws-tab--file">
          <FileIcon ext={doc.kind} />
          <span className="ws-tab__label ws-tab__label--italic">{doc.filename}</span>
          <span className="ws-tab__x" aria-hidden>
            ×
          </span>
        </button>
        <button role="tab" className="ws-tab">
          <WaveDot />
          <span className="ws-tab__label">Wavelength</span>
          <span className="ws-tab__x" aria-hidden>
            ×
          </span>
        </button>
        <button className="ws-tab ws-tab--new" aria-label="New tab">
          +
        </button>
      </div>

      <header className="out__filehead">
        <div className="out__filehead-main">
          <div className="out__filename">{doc.filename}</div>
          <div className="mono out__filepath">{doc.filepath}</div>
        </div>
        <div className="out__filehead-actions">
          <button className="out__iconbtn" aria-label="Reveal in vault">
            <FolderActionIcon />
          </button>
          <button className="out__iconbtn" aria-label="Edit">
            <PencilIcon />
          </button>
          <button className="out__iconbtn" aria-label="Open external">
            <ExternalIcon />
          </button>
          <button className="out__iconbtn" aria-label="Close tab">
            <XIcon />
          </button>
        </div>
      </header>

      <div className="out__toolstrip">
        <button className="out__iconbtn" aria-label="Refresh">
          <RefreshIcon />
        </button>
        <button className="out__iconbtn" aria-label="Run">
          <PlayIcon />
        </button>
      </div>

      <div className="out__viewport scroll">
        <div className="out__hero">
          <h1 className="out__hero-title">{doc.hero}</h1>
          <p className="out__hero-sub">{doc.subtitle}</p>
        </div>
        <p className="out__placeholder mono">
          ← Seed the vault file <span className="out__placeholder-strong">{doc.filename}</span> to render content here.
        </p>
      </div>

      <div className="out__progress">
        <span className="mono out__progress-hint">← → or click to navigate</span>
        <div className="out__progress-track">
          <div className="out__progress-fill" style={{ width: `${Math.max(6, progress * 100)}%` }} />
        </div>
        <span className="mono out__progress-count">
          <span className="out__progress-current">{doc.currentPage}</span>
          <span className="out__progress-total"> / {doc.totalPages}</span>
        </span>
      </div>

      <div className="out__mode">
        <span className="caps">{modeLabel}</span>
        <span className="chip__sep" />
        <span className="out__mode-sub">Read mode</span>
      </div>
    </section>
  );
}

/* ---------- icons ---------- */
function FileIcon({ ext }: { ext: string }) {
  const color = ext === "md" ? "var(--amber-ink)" : ext === "csv" ? "var(--ok)" : "var(--ink-muted)";
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
      <path
        d="M3 1.5h5l2.5 2.5v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
        fill="none"
        stroke={color}
        strokeWidth={1.3}
      />
      <path d="M8 1.5v2.5h2.5" fill="none" stroke={color} strokeWidth={1.3} />
    </svg>
  );
}

function WaveDot() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
      <path
        d="M1 6.5 C 3 3, 4 10, 6.5 6.5 C 9 3, 10 10, 12 6.5"
        fill="none"
        stroke="#e0001a"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderActionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.3}>
      <path d="M1.5 3.5a1 1 0 0 1 1-1h2l1 1h5a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V3.5z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 11l1.8-.45 6-6-1.35-1.35-6 6L2 11z" />
      <path d="M8.5 3.2l1.3-1.3a1 1 0 0 1 1.5 1.5l-1.3 1.3" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5H2.5v8h8V7" />
      <path d="M7 2.5h3.5V6" />
      <path d="M10.5 2.5L6 7" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
      <path d="M2 2l7 7M9 2l-7 7" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.5a4.5 4.5 0 0 1 8-2.8M10.5 2v2.8H7.7" />
      <path d="M11 6.5a4.5 4.5 0 0 1-8 2.8M2.5 11V8.2H5.3" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M3 2l7 4-7 4z" fill="currentColor" />
    </svg>
  );
}

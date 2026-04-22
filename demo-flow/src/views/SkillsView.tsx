import { useMemo, useState, type ReactElement } from "react";
import { SidebarSearch } from "./shared/SidebarDetail";
import "./skills.css";

/* --- Training kits and skill taxonomy --------------------------------
 * Concept: Wavelength is Tinker's training centre. A Surfer (agent)
 * coaches each employee through Kits of skills that ladder up to Mastery.
 * Kits are the grouping; Skills are the atoms inside each kit.
 * ------------------------------------------------------------------ */

type KitId =
  | "essentials"
  | "sales"
  | "account-management"
  | "customer-experience"
  | "onboarding"
  | "workflows"
  | "analytics"
  | "research";

type Kit = {
  id: KitId;
  name: string;
  blurb: string;
  /** tint = used for both the icon and the card's soft background tint */
  tint: string;
  progress: number; // 0..1
  skills: number;
  mastered: number;
  /** inline SVG renderer */
  icon: () => ReactElement;
};

const KITS: ReadonlyArray<Kit> = [
  {
    id: "essentials",
    name: "Essentials",
    blurb: "The first hour with Tinker — how to search, how to cite, how to ship.",
    tint: "#f4b45a",
    progress: 0.4,
    skills: 10,
    mastered: 4,
    icon: BookshelfIcon,
  },
  {
    id: "sales",
    name: "Sales",
    blurb: "From whitespace to outreach to follow-up, tuned to the Keysight motion.",
    tint: "#f08a65",
    progress: 0.2,
    skills: 10,
    mastered: 2,
    icon: HandshakeIcon,
  },
  {
    id: "account-management",
    name: "Account Management",
    blurb: "Retention, renewal risk, and expansion moves for existing accounts.",
    tint: "#58c5c1",
    progress: 0,
    skills: 10,
    mastered: 0,
    icon: OrbitIcon,
  },
  {
    id: "customer-experience",
    name: "Customer Experience",
    blurb: "Lab-ops digests, support triage, post-mortems, and voice-of-customer rollups.",
    tint: "#d17fc8",
    progress: 0,
    skills: 10,
    mastered: 0,
    icon: PersonIcon,
  },
  {
    id: "onboarding",
    name: "Onboarding",
    blurb: "Stand up a new AE / SE — account seeding, toolchain setup, first-30-day loop.",
    tint: "#f7a646",
    progress: 0,
    skills: 10,
    mastered: 0,
    icon: PlayIcon,
  },
  {
    id: "workflows",
    name: "Workflows",
    blurb: "Compose multi-step routines that chain skills — QBR builder, weekly ops digest.",
    tint: "#9088e7",
    progress: 0,
    skills: 10,
    mastered: 0,
    icon: FlowIcon,
  },
  {
    id: "analytics",
    name: "Analytics",
    blurb: "Query the warehouse, shape cohorts, draft narratives grounded in facts.",
    tint: "#e7679b",
    progress: 0,
    skills: 10,
    mastered: 0,
    icon: DiamondIcon,
  },
  {
    id: "research",
    name: "Research",
    blurb: "Competitive teardowns, filings, and public-signal synthesis at scale.",
    tint: "#5fb97f",
    progress: 0.1,
    skills: 10,
    mastered: 1,
    icon: LensIcon,
  },
];

type ChatTab = { id: string; label: string; kind: "training" | "session"; active?: boolean };

const CHAT_TABS: ReadonlyArray<ChatTab> = [
  { id: "c-1", label: "Let me read tha…", kind: "session" },
  { id: "c-2", label: "Wavelength", kind: "training", active: true },
  { id: "c-3", label: "Claude Cod…", kind: "session" },
];

export function SkillsView() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("c-2");

  const filteredKits = useMemo(() => {
    if (!query) return KITS;
    const q = query.toLowerCase();
    return KITS.filter((k) => k.name.toLowerCase().includes(q) || k.blurb.toLowerCase().includes(q));
  }, [query]);

  const totalMastered = KITS.reduce((s, k) => s + k.mastered, 0);

  return (
    <div className="skills-wave">
      <aside className="skills-wave__sidebar">
        <div className="skills-wave__tabs">
          {CHAT_TABS.map((t) => (
            <button
              key={t.id}
              className="skills-wave__tab"
              data-active={t.id === activeTab}
              data-kind={t.kind}
              onClick={() => setActiveTab(t.id)}
            >
              {t.kind === "training" ? (
                <WaveMini />
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2 3.5c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v3c0 .55-.45 1-1 1H5L3 9V7.5c-.55 0-1-.45-1-1v-3z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.3}
                  />
                </svg>
              )}
              <span className="skills-wave__tab-label">{t.label}</span>
              {t.id === activeTab && (
                <svg width="9" height="9" viewBox="0 0 9 9" className="skills-wave__tab-x" aria-hidden>
                  <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
          <button className="skills-wave__tab skills-wave__tab--new">
            <span className="skills-wave__tab-plus">+</span>
            <span>New chat</span>
          </button>
        </div>
      </aside>

      <main className="skills-wave__main">
        <div className="skills-wave__bg" aria-hidden />
        <div className="skills-wave__searchbar">
          <SidebarSearch placeholder="Search skills…" value={query} onChange={setQuery} />
        </div>

        <div className="skills-wave__canvas scroll">
          <section className="skills-wave__hero">
            <div className="skills-wave__avatar">
              <SurferGlyph />
            </div>
            <h1 className="skills-wave__title">Khani&rsquo;s Wavelength</h1>
            <span className="skills-wave__rank">Master</span>
            <p className="skills-wave__summary">
              <strong>{totalMastered}</strong> skills mastered
              <span className="skills-wave__summary-sep" />
              <span className="skills-wave__summary-sub">coached by Surfer</span>
            </p>
            <button className="skills-wave__cta">Start Training</button>
          </section>

          <section className="skills-wave__kits">
            <header className="skills-wave__kits-head">
              <KitBoxIcon />
              <h2>Kits</h2>
              <span className="skills-wave__kits-count mono">{filteredKits.length} kits · {KITS.reduce((s, k) => s + k.skills, 0)} skills</span>
            </header>
            <div className="skills-wave__kits-grid">
              {filteredKits.map((k) => (
                <KitCard key={k.id} kit={k} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function KitCard({ kit }: { kit: Kit }) {
  const Icon = kit.icon;
  return (
    <button
      className="kit"
      style={{
        // the card tint comes from kit color, very soft
        ["--kit-tint" as string]: kit.tint,
      }}
    >
      <span className="kit__progress mono">
        {kit.mastered}/{kit.skills}
      </span>
      <span className="kit__icon">
        <Icon />
      </span>
      <span className="kit__name">{kit.name}</span>
      <span className="kit__blurb">{kit.blurb}</span>
      <span className="kit__bar" aria-hidden>
        <span className="kit__bar-fill" style={{ width: `${Math.max(6, kit.progress * 100)}%` }} />
      </span>
    </button>
  );
}

/* ---------- Inline SVGs ---------- */

function WaveMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M1 7 C 3 3, 4 11, 6.5 7 C 9 3, 10 11, 13 7"
        fill="none"
        stroke="#e0001a"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SurferGlyph() {
  // a bold "wave + figure" monogram used as the training mascot
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden>
      <rect x="2" y="2" width="64" height="64" rx="12" fill="#1a1612" />
      <path
        d="M8 44 C 18 28, 26 52, 36 36 C 46 20, 52 46, 60 36"
        fill="none"
        stroke="#e0001a"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="22" r="5" fill="#f9c041" />
      <path d="M29 30 L39 30 L41 40 L27 40 Z" fill="#f9c041" />
    </svg>
  );
}

function KitBoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M2 6.5l7-3 7 3-7 3-7-3z" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M2 6.5v6l7 3 7-3v-6" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M9 9.5v6" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}

function BookshelfIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
        <rect x="7" y="8" width="5" height="24" />
        <rect x="14" y="12" width="5" height="20" />
        <rect x="21" y="6" width="5" height="26" transform="rotate(8 23.5 19)" />
        <rect x="28" y="10" width="5" height="22" />
      </g>
    </svg>
  );
}

function HandshakeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l7-6h6l3 3 3-3h7l6 6" />
        <path d="M10 20l6 6 3-2 3 2 6-6" />
        <circle cx="20" cy="9" r="1.6" />
        <path d="M20 12l0 4" />
      </g>
    </svg>
  );
}

function OrbitIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <circle cx="20" cy="20" r="3" />
        <circle cx="20" cy="20" r="11" strokeDasharray="1.5 3" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="30" cy="28" r="2" />
        <path d="M12 12l16 16" opacity="0.4" />
      </g>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="14" r="5" />
        <path d="M8 34c0-6 6-10 12-10s12 4 12 10" />
      </g>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="10" width="30" height="20" rx="2" />
        <path d="M17 17l8 5-8 5z" fill="currentColor" />
        <circle cx="9" cy="6" r="0.8" fill="currentColor" />
        <circle cx="13" cy="6" r="0.8" fill="currentColor" />
      </g>
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="6" width="10" height="8" rx="1" />
        <rect x="25" y="6" width="10" height="8" rx="1" />
        <rect x="5" y="26" width="10" height="8" rx="1" />
        <rect x="25" y="26" width="10" height="8" rx="1" />
        <path d="M15 10h10M15 30h10M10 14v12M30 14v12" />
      </g>
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
        <path d="M20 6L32 14L28 32H12L8 14L20 6z" />
        <path d="M14 14h12M20 6v26" opacity="0.4" />
      </g>
    </svg>
  );
}

function LensIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <circle cx="17" cy="17" r="11" />
        <path d="M25 25l8 8" />
        <path d="M12 17a5 5 0 015-5" opacity="0.4" />
      </g>
    </svg>
  );
}

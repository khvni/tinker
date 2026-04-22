import type { DemoKey, ChatTurn } from "../../seed/types";
import * as demo1 from "../../seed/demo1-whitespace";
import * as demo2 from "../../seed/demo2-enrichment";
import * as demo3 from "../../seed/demo3-meeting";

type Props = {
  demo: DemoKey;
  onChangeDemo: (d: DemoKey) => void;
  auditOpen: boolean;
  onToggleAudit: () => void;
};

const TABS: ReadonlyArray<{ key: DemoKey; label: string; dot?: string }> = [
  { key: "whitespace", label: "Marvell · whitespace", dot: "var(--amber)" },
  { key: "enrichment", label: "Enrich 8-company list", dot: "var(--ok)" },
  { key: "meeting", label: "Orbion · Anika prep" },
];

export function ChatPane({ demo, onChangeDemo, auditOpen, onToggleAudit }: Props) {
  const transcript = getTranscript(demo);

  return (
    <section className="pane pane--chat">
      <div className="ws-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === demo}
            className={`ws-tab ${t.key === demo ? "ws-tab--active" : ""}`}
            onClick={() => onChangeDemo(t.key)}
          >
            {t.dot && <span className="ws-tab__dot" style={{ background: t.dot }} />}
            <span className="ws-tab__label">{t.label}</span>
            <span className="ws-tab__x" aria-hidden>
              ×
            </span>
          </button>
        ))}
        <button className="ws-tab ws-tab--new" aria-label="New chat">
          +
        </button>
      </div>

      <div className="chat__body scroll">
        <div className="chat__stream">
          {transcript.map((t, i) => (
            <Turn key={i} turn={t} />
          ))}
        </div>
      </div>

      <div className="chat__footer">
        <div className="chat__status-dock">
          <div className="chip">
            <span className="chip__icon" aria-hidden />
            <span>Context</span>
            <span className="chip__sep" />
            <span className="mono">4%</span>
          </div>
          <button
            className={`chip chat__audit-toggle ${auditOpen ? "chip--on" : ""}`}
            onClick={onToggleAudit}
            aria-pressed={auditOpen}
          >
            <span className="chat__audit-dot" />
            <span className="mono">audit</span>
          </button>
          <div className="chat__status-spacer" />
          <span className="chat__run-dot" aria-label="Session running" />
          <button className="chat__kebab" aria-label="More">
            <span /> <span /> <span />
          </button>
        </div>

        <div className="composer">
          <textarea className="composer__input" placeholder="Reply…" rows={1} defaultValue="" />
          <div className="composer__controls">
            <button className="composer__plus" aria-label="Attach">
              +
            </button>
            <div className="composer__spacer" />
            <button className="composer__send" aria-label="Send">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 10V2M2.5 5.5L6 2l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="chat__bottom-controls">
          <button className="chip chip--accent">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M6 1l-3 6h2.5L5 11l4-6H6.5L7 1z" fill="currentColor" />
            </svg>
            <span>Auto Accept</span>
          </button>
          <button className="chip">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth={1.2} />
              <circle cx="6" cy="6" r="1.5" fill="none" stroke="currentColor" strokeWidth={1.2} />
            </svg>
            <span>Default</span>
            <span className="chip__sep" />
            <span className="chip__strong">Opus 4.6</span>
          </button>
          <div className="chat__bottom-spacer" />
          <button className="chip">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M1.5 3.5c0-.55.45-1 1-1h2l1 1h5c.55 0 1 .45 1 1v5c0 .55-.45 1-1 1h-8c-.55 0-1-.45-1-1v-5z"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.3}
              />
            </svg>
            <span>keysight-west / accounts</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  if (turn.kind === "user") {
    return (
      <div className="turn turn--user">
        <p className="turn__text">{turn.text}</p>
      </div>
    );
  }
  if (turn.kind === "assistant-thinking") {
    return <div className="turn turn--thinking">{turn.note}</div>;
  }
  return (
    <div className="turn turn--assist">
      {turn.text.split("\n\n").map((p, i) => (
        <p key={i} className="turn__text">
          {p}
        </p>
      ))}
    </div>
  );
}

function getTranscript(demo: DemoKey): ReadonlyArray<ChatTurn> {
  switch (demo) {
    case "whitespace":
      return demo1.transcript;
    case "enrichment":
      return demo2.transcript;
    case "meeting":
      return demo3.transcript;
  }
}

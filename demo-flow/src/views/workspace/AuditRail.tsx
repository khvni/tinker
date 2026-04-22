import { useMemo, useState } from "react";
import type { DemoKey, ToolCall } from "../../seed/types";
import * as demo1 from "../../seed/demo1-whitespace";
import * as demo2 from "../../seed/demo2-enrichment";
import * as demo3 from "../../seed/demo3-meeting";

type Props = {
  open: boolean;
  demo: DemoKey;
  onClose: () => void;
};

export function AuditRail({ open, demo, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const calls = useMemo(() => extractCalls(demo), [demo]);
  const totalMs = calls.reduce((s, c) => s + c.durationMs, 0);

  return (
    <div className={`audit ${open ? "audit--open" : "audit--closed"}`} aria-hidden={!open}>
      <header className="audit__head">
        <span className="caps audit__caps">Tool calls · reasoning audit</span>
        <span className="mono audit__summary">
          <span className="audit__dot" /> {calls.length} call{calls.length === 1 ? "" : "s"} ·{" "}
          {(totalMs / 1000).toFixed(2)}s · grounded
        </span>
        <div className="audit__spacer" />
        <button className="audit__close mono" onClick={onClose} aria-label="Hide">
          hide
        </button>
      </header>
      <ol className="audit__list">
        {calls.map((c, i) => {
          const id = `${i}-${c.name}`;
          const isOpen = expanded === id;
          return (
            <li key={id} className={`audit__item ${isOpen ? "audit__item--open" : ""}`}>
              <button className="audit__row" onClick={() => setExpanded(isOpen ? null : id)}>
                <span className="mono audit__idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="mono audit__name">{c.name}</span>
                <span className="audit__label">{c.label}</span>
                <span className="mono audit__args">{c.args}</span>
                <span className="audit__spacer" />
                <span className="mono audit__ms">{c.durationMs}ms</span>
                <span className="audit__result">{c.result}</span>
                <span className="audit__chev" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>
              {isOpen && c.details && (
                <ul className="audit__details">
                  {c.details.map((d, j) => (
                    <li key={j} className="mono">
                      <span className="audit__details-pip">·</span>
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function extractCalls(demo: DemoKey): ReadonlyArray<ToolCall> {
  const transcript =
    demo === "whitespace" ? demo1.transcript : demo === "enrichment" ? demo2.transcript : demo3.transcript;
  const out: ToolCall[] = [];
  for (const t of transcript) {
    if (t.kind === "assistant" && t.toolCalls) out.push(...t.toolCalls);
  }
  return out;
}

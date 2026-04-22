import { useMemo, useState } from "react";
import { SidebarDetailLayout, SidebarSearch } from "./shared/SidebarDetail";
import { bucketRollup, connectionsV2, type ConnectionV2, type Logo, type PermState, type ToolPermission } from "../seed/connections-v2";
import "./connections.css";

export function ConnectionsView() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("slack");
  const [overrides, setOverrides] = useState<Record<string, PermState>>({});

  const filtered = useMemo(() => {
    if (!query) return connectionsV2;
    const q = query.toLowerCase();
    return connectionsV2.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const selected = connectionsV2.find((c) => c.id === selectedId) ?? connectionsV2[0]!;

  const readOnly = applyOverrides(selected.readOnly, overrides);
  const writeDelete = applyOverrides(selected.writeDelete, overrides);

  const setToolState = (toolId: string, state: PermState) => {
    setOverrides((o) => ({ ...o, [toolId]: state }));
  };

  return (
    <SidebarDetailLayout
      sidebarWidth={304}
      sidebar={
        <>
          <SidebarSearch placeholder="Search…" value={query} onChange={setQuery} />
          <div className="conn__sidebar-list scroll">
            <div className="sd__group">
              <svg width="10" height="10" viewBox="0 0 10 10" className="sd__group-caret" aria-hidden>
                <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
              </svg>
              <span className="sd__group-label">Connected</span>
              <span className="sd__group-count">{filtered.length}</span>
            </div>
            {filtered.map((c) => (
              <button
                key={c.id}
                className="conn__sidebar-row"
                data-active={selectedId === c.id}
                onClick={() => setSelectedId(c.id)}
              >
                <LogoSquare logo={c.logo} size={20} />
                <span className="conn__sidebar-name">{c.name}</span>
                {c.connected && <span className="conn__sidebar-dot" aria-hidden />}
              </button>
            ))}
          </div>
        </>
      }
      detail={
        <ConnectionDetail
          conn={selected}
          readOnly={readOnly}
          writeDelete={writeDelete}
          onSetTool={setToolState}
        />
      }
    />
  );
}

function ConnectionDetail({
  conn,
  readOnly,
  writeDelete,
  onSetTool,
}: {
  conn: ConnectionV2;
  readOnly: ReadonlyArray<ToolPermission>;
  writeDelete: ReadonlyArray<ToolPermission>;
  onSetTool: (toolId: string, state: PermState) => void;
}) {
  return (
    <div className="conn__detail scroll">
      <div className="conn__detail-wrap">
        <header className="conn__head">
          <LogoSquare logo={conn.logo} size={48} />
          <div className="conn__head-main">
            <div className="conn__head-titlerow">
              <h1 className="conn__head-name">{conn.name}</h1>
              <span className="conn__head-status">
                <span className="conn__head-status-dot" /> Connected
              </span>
            </div>
            <p className="conn__head-desc">{conn.description}</p>
          </div>
          <button className="conn__head-menu" aria-label="More">
            <span /> <span /> <span />
          </button>
        </header>

        <section className="conn__section">
          <h2 className="conn__section-title">Tool permissions</h2>
          <p className="conn__section-sub">Choose when Tinker is allowed to use these tools.</p>
        </section>

        <Bucket
          label="Read-only tools"
          tools={readOnly}
          onSetTool={onSetTool}
          emptyNote="No read-only tools for this connection."
        />
        <Bucket
          label="Write/delete tools"
          tools={writeDelete}
          onSetTool={onSetTool}
          emptyNote="This connection is read-only — no write/delete tools."
        />
      </div>
    </div>
  );
}

function Bucket({
  label,
  tools,
  onSetTool,
  emptyNote,
}: {
  label: string;
  tools: ReadonlyArray<ToolPermission>;
  onSetTool: (id: string, state: PermState) => void;
  emptyNote: string;
}) {
  const rollup = bucketRollup(tools);
  return (
    <section className="conn__bucket">
      <header className="conn__bucket-head">
        <button className="conn__bucket-toggle" aria-expanded>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="conn__bucket-label">{label}</span>
        </button>
        {tools.length > 0 && <RollupBadge state={rollup} />}
      </header>
      {tools.length === 0 ? (
        <div className="conn__bucket-empty">{emptyNote}</div>
      ) : (
        <ul className="conn__tool-list">
          {tools.map((t) => (
            <li key={t.id} className="conn__tool-row">
              <span className="conn__tool-name">{t.name}</span>
              <PermPicker value={t.state} onChange={(s) => onSetTool(t.id, s)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PermPicker({ value, onChange }: { value: PermState; onChange: (s: PermState) => void }) {
  const options: ReadonlyArray<{ key: PermState; label: string }> = [
    { key: "auto", label: "Auto" },
    { key: "allow", label: "Allow" },
    { key: "ask", label: "Ask" },
  ];
  return (
    <div className="perm" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          className="perm__pill"
          data-state={o.key}
          data-active={value === o.key}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RollupBadge({ state }: { state: "auto" | "allow" | "ask" | "mixed" | "empty" }) {
  if (state === "empty") return null;
  const label =
    state === "auto" ? "Auto" : state === "allow" ? "Allow" : state === "ask" ? "Ask" : "Mixed";
  return (
    <div className="perm__rollup" data-state={state}>
      <span>{label}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function LogoSquare({ logo, size }: { logo: Logo; size: number }) {
  const fontSize = Math.round(size * 0.46);
  return (
    <span
      className="conn__logo"
      style={{
        width: size,
        height: size,
        background: logo.bg,
        color: logo.fg,
        fontSize,
      }}
      aria-hidden
    >
      {logo.mark}
    </span>
  );
}

function applyOverrides(
  tools: ReadonlyArray<ToolPermission>,
  overrides: Record<string, PermState>
): ReadonlyArray<ToolPermission> {
  return tools.map((t) => (overrides[t.id] ? { ...t, state: overrides[t.id]! } : t));
}

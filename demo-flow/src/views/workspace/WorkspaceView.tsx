import { useState } from "react";
import { ChatPane } from "./ChatPane";
import { OutputPane } from "./OutputPane";
import { AuditRail } from "./AuditRail";
import type { DemoKey } from "../../seed/types";
import "./workspace.css";

/** Tinker Workspace — Light.
 *
 * Faithful 2-pane layout from the Paper artboard:
 * LeftPane (chat) + RightPane (output viewer) + optional audit rail at bottom.
 * Seed is intentionally minimal — the user overwrites it with real data. */
export function WorkspaceView() {
  const [demo, setDemo] = useState<DemoKey>("whitespace");
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <div className="workspace">
      <div className="workspace__panes">
        <ChatPane
          demo={demo}
          onChangeDemo={setDemo}
          auditOpen={auditOpen}
          onToggleAudit={() => setAuditOpen((v) => !v)}
        />
        <div className="workspace__right">
          <OutputPane demo={demo} />
          <AuditRail open={auditOpen} demo={demo} onClose={() => setAuditOpen(false)} />
        </div>
      </div>
    </div>
  );
}

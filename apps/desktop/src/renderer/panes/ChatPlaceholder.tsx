import type { PaneComponent } from '../workspace/pane-registry.js';

export const ChatPlaceholder: PaneComponent = () => {
  return (
    <div className="glass-pane glass-pane--placeholder">
      <h2>Chat</h2>
      <p>W1 · agent-runtime owner: replace this placeholder with a real chat pane.</p>
      <p>See <code>tasks/agent-runtime.md</code>.</p>
    </div>
  );
};

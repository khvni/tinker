import type { PaneComponent } from '../workspace/pane-registry.js';

export const DojoPlaceholder: PaneComponent = () => {
  return (
    <div className="glass-pane glass-pane--placeholder">
      <h2>Dojo</h2>
      <p>W3 · skills owner: replace this placeholder with the real Dojo pane.</p>
      <p>See <code>tasks/skills.md</code>.</p>
    </div>
  );
};

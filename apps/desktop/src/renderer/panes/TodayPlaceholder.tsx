import type { PaneComponent } from '../workspace/pane-registry.js';

export const TodayPlaceholder: PaneComponent = () => {
  return (
    <div className="glass-pane glass-pane--placeholder">
      <h2>Today</h2>
      <p>
        W2 · memory owner: replace this placeholder with a real Today pane surfacing the user's
        recent entities, projects, and scheduled jobs from memory.
      </p>
      <p>See <code>tasks/memory.md</code>.</p>
    </div>
  );
};

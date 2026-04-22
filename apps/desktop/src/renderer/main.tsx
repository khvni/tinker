import { StrictMode, Suspense, lazy, useEffect, type JSX, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/host-grotesk';
import '@tinker/panes/styles.css';
import { App } from './App.js';
import { registerWorkspacePaneRenderers } from './workspace/register-pane-renderers.js';
import { registerWorkspacePanes } from './workspace/register-panes.js';
import { applyTheme, readTheme } from './theme.js';
import './styles.css';

registerWorkspacePaneRenderers();
registerWorkspacePanes();

applyTheme(readTheme() ?? 'light');

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element missing');
}

const route = new URLSearchParams(window.location.search).get('route');

// Dev-only routes are lazy so they don't bloat the production boot bundle.
const DesignSystem = lazy(() => import('./routes/design-system.js').then((m) => ({ default: m.DesignSystem })));
const PanesDemo = lazy(() => import('./routes/panes-demo.js').then((m) => ({ default: m.PanesDemo })));

// `App` owns its own appReady flag; lazy dev routes don't, so we mark them
// ready once the Suspense boundary resolves (for the visual-test harness).
const DevRouteReadyMarker = ({ children }: { children: ReactNode }): JSX.Element => {
  useEffect(() => {
    document.documentElement.dataset['appReady'] = 'true';
  }, []);
  return <>{children}</>;
};

const renderRoute = (): JSX.Element => {
  if (route === 'design-system') {
    return (
      <Suspense fallback={null}>
        <DevRouteReadyMarker>
          <DesignSystem />
        </DevRouteReadyMarker>
      </Suspense>
    );
  }
  if (route === 'panes-demo') {
    return (
      <Suspense fallback={null}>
        <DevRouteReadyMarker>
          <PanesDemo />
        </DevRouteReadyMarker>
      </Suspense>
    );
  }
  return <App />;
};

createRoot(container).render(<StrictMode>{renderRoute()}</StrictMode>);

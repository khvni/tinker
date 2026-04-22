import { StrictMode, Suspense, lazy, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/host-grotesk';
import { App } from './App.js';
import { registerWorkspacePanes } from './workspace/register-panes.js';
import { applyTheme, readTheme } from './theme.js';
import './styles.css';

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

const renderRoute = (): JSX.Element => {
  if (route === 'design-system') {
    return (
      <Suspense fallback={null}>
        <DesignSystem />
      </Suspense>
    );
  }
  if (route === 'panes-demo') {
    return (
      <Suspense fallback={null}>
        <PanesDemo />
      </Suspense>
    );
  }
  return <App />;
};

createRoot(container).render(<StrictMode>{renderRoute()}</StrictMode>);

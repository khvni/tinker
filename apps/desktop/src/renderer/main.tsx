import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/host-grotesk';
import 'dockview-react/dist/styles/dockview.css';
import { App } from './App.js';
import { DesignSystem } from './routes/design-system.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element missing');
}

const route = new URLSearchParams(window.location.search).get('route');
const root = route === 'design-system' ? <DesignSystem /> : <App />;

createRoot(container).render(<StrictMode>{root}</StrictMode>);

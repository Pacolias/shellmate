import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelpLevelProvider } from './app-state/HelpLevelContext';
import { App } from './App';
import './theme/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <HelpLevelProvider>
      <App />
    </HelpLevelProvider>
  </StrictMode>,
);

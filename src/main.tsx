import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { useStore } from './store/useStore';

// Apply persisted theme before first paint.
document.documentElement.setAttribute('data-theme', useStore.getState().theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

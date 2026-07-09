import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CrmDashboard from './CrmDashboard';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrmDashboard />
  </StrictMode>,
);

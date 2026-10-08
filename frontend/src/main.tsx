import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CompositionRoot } from './platform/composition-root';
import './presentation/theme/global.css';
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <CompositionRoot />
  </StrictMode>,
);

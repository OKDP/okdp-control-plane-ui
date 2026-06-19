import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// The PrimeReact theme is imported by styles.css: it must load after the
// @layer order declared there, or preflight strips its component styles.
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

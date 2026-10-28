import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provedor } from './data/store';
import { App } from './ui/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provedor>
      <App />
    </Provedor>
  </StrictMode>,
);

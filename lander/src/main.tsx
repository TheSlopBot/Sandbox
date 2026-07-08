import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './style.css';

const el = document.querySelector<HTMLDivElement>('#root');
if (!el) throw new Error('Missing #root');

createRoot(el).render(
  <App />,
);


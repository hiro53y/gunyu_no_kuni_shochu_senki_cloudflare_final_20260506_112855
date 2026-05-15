import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      // PWA登録に失敗してもゲーム本体は継続する
    });
  });
}

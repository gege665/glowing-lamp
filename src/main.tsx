import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showBootError(message: string) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `<div style="min-height:100vh;padding:24px;background:#2e1065;color:#fce7f3;font-family:system-ui,sans-serif">
    <h1 style="font-size:18px;margin:0 0 12px">页面加载失败</h1>
    <p style="font-size:14px;line-height:1.6;opacity:.9">请运行 <code style="color:#f9a8d4">npm run dev</code> 后访问 <a href="http://127.0.0.1:5173" style="color:#f9a8d4">http://127.0.0.1:5173</a></p>
    <pre style="margin-top:12px;padding:12px;background:rgba(0,0,0,.25);border-radius:8px;font-size:12px;white-space:pre-wrap">${escapeHtml(message)}</pre>
  </div>`;
}

let appMounted = false;

window.addEventListener('error', (event) => {
  if (!appMounted) {
    if (event.message) showBootError(event.message);
    return;
  }
  console.error('[runtime]', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  if (!appMounted) {
    showBootError(message);
    return;
  }
  console.error('[unhandledrejection]', reason);
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
appMounted = true;

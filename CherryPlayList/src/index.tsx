import { bootstrapApp } from './bootstrap';

function showBootstrapError(message: string): void {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }

  root.innerHTML = `
    <div style="padding:24px;font-family:system-ui,sans-serif;color:#f5f5f5;background:#1e1e1e;min-height:100vh;">
      <h1 style="margin:0 0 12px;font-size:18px;">CherryPlayList не запустился</h1>
      <pre style="margin:0;white-space:pre-wrap;color:#ffb4b4;">${message}</pre>
    </div>
  `;
}

void bootstrapApp()
  .then(() => import('./entry'))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CherryPlayList] Bootstrap failed:', error);
    showBootstrapError(message);
  });

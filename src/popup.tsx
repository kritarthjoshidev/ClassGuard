import React from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <main style={{ width: 320, padding: 18, color: '#172033', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20 }}>🛡 ClassGuard</h1>
        <p style={{ margin: '0 0 14px', color: '#475569', fontSize: 12 }}>Local security signals for Google Meet</p>
        <section style={{ padding: 12, borderRadius: 12, background: '#eff6ff', fontSize: 12, lineHeight: 1.5 }}>
          <strong>Ready for a Meet tab</strong>
          <p style={{ margin: '5px 0 0' }}>Open a Google Meet meeting to see the in-call panel. Monitoring starts only on an active Meet URL.</p>
        </section>
        <h2 style={{ margin: '16px 0 6px', fontSize: 13 }}>Privacy and limits</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 11, lineHeight: 1.55 }}>
          <li>Message checks run locally in this browser session.</li>
          <li>Message text is not saved to browser storage or sent to a service.</li>
          <li>Chat senders remain unverified when Meet does not expose reliable attribution.</li>
          <li>Alerts are heuristic review signals, not proof of malicious intent.</li>
        </ul>
      </main>
    </React.StrictMode>,
  );
}

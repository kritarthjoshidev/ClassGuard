import React from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <main style={{ minWidth: 280, padding: 20, fontFamily: 'sans-serif' }}>
        <h1 style={{ marginTop: 0 }}>🛡 ClassGuard</h1>
        <p>Protection Active</p>
        <p style={{ color: '#64748b' }}>Local-first behavior monitoring for Google Meet.</p>
      </main>
    </React.StrictMode>,
  );
}

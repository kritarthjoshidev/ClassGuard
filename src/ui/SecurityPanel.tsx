import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Participant } from '../adapters/meet/participant-detector';

export interface SecurityPanelProps {
  participants?: Participant[];
}

const panelStyles = `
  :host {
    all: initial;
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    width: 252px;
    color: #111827;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: none;
  }
  * { box-sizing: border-box; }
  .panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 252px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 14px 38px rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(14px);
    pointer-events: auto;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 10px 14px;
    background: #0f172a;
    color: white;
    touch-action: none;
    user-select: none;
    cursor: grab;
  }
  .header:active { cursor: grabbing; }
  .title { margin: 0; font-size: 13px; font-weight: 800; letter-spacing: .04em; }
  .status { margin: 3px 0 0; color: #cbd5e1; font-size: 11px; }
  .button {
    border: 1px solid rgba(255,255,255,.35);
    border-radius: 8px;
    background: transparent;
    color: white;
    cursor: pointer;
    font: inherit;
    padding: 5px 8px;
  }
  .button:hover { background: rgba(255,255,255,.12); }
  .body { padding: 12px 14px 14px; }
  .metric { margin: 0 0 7px; color: #334155; font-size: 12px; }
  .metric strong { color: #0f172a; }
  .counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0 12px; }
  .count { padding: 7px 6px; border-radius: 8px; background: #f8fafc; text-align: center; font-size: 11px; }
  .count strong { display: block; font-size: 16px; }
  .participant-list { display: grid; gap: 6px; margin-top: 10px; }
  .participant { padding: 7px 8px; border-radius: 8px; background: #f8fafc; color: #0f172a; font-size: 11px; overflow-wrap: anywhere; }
  .collapsed .body { display: none; }
  .collapsed .header { border-radius: 14px 14px 0 0; }
`;

export function SecurityPanel({ participants = [] }: SecurityPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const clampPosition = (x: number, y: number): { x: number; y: number } => {
    const panelWidth = panelRef.current?.offsetWidth || 252;
    const panelHeight = panelRef.current?.offsetHeight || 150;
    return {
      x: Math.min(Math.max(x, 0), Math.max(0, window.innerWidth - panelWidth)),
      y: Math.min(Math.max(y, 0), Math.max(0, window.innerHeight - panelHeight)),
    };
  };

  useEffect(() => {
    const handleResize = (): void => {
      if (position) {
        setPosition((current) => current ? { ...current, ...clampPosition(current.x ?? 0, current.y) } : current);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  const beginDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || !(panelRef.current && headerRef.current)) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    dragging.current = true;
    headerRef.current.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (!dragging.current) return;
    const next = clampPosition(event.clientX - dragOffset.current.x, event.clientY - dragOffset.current.y);
    setPosition(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (!dragging.current) return;
    dragging.current = false;
    const header = headerRef.current;
    if (header?.hasPointerCapture(event.pointerId)) {
      header.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={panelRef}
      className={collapsed ? 'panel collapsed' : 'panel'}
      aria-label="ClassGuard security panel"
      style={position ? { left: position.x, top: position.y, right: 'auto' } : undefined}
    >
      <style>{panelStyles}</style>
      <header
        ref={headerRef}
        className="header"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div>
          <h2 className="title">🛡 CLASSGUARD</h2>
          <p className="status">Protection: ON</p>
        </div>
        <button
          className="button"
          type="button"
          aria-label={collapsed ? 'Expand security panel' : 'Minimize security panel'}
          aria-expanded={!collapsed}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? '+' : '−'}
        </button>
      </header>
      <div className="body">
        <p className="metric"><strong>Participants:</strong> {participants.length}</p>
        <div className="participant-list" aria-label="Observed participant names">
          {participants.length === 0
            ? <div className="participant">Waiting for observable participants.</div>
            : participants.map((participant) => (
              <div className="participant" key={participant.participantName}>
                • {participant.participantName}
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

export interface SecurityPanelController {
  setParticipants: (participants: Participant[]) => void;
  unmount: () => void;
}

export function mountSecurityPanel(root: HTMLElement, participants: Participant[] = []): SecurityPanelController {
  const shadowRoot = root.attachShadow({ mode: 'open' });
  const reactRoot = createRoot(shadowRoot);
  let currentParticipants = participants;

  const render = (): void => {
    reactRoot.render(
      <React.StrictMode>
        <SecurityPanel participants={currentParticipants} />
      </React.StrictMode>,
    );
  };

  render();

  return {
    setParticipants: (nextParticipants) => {
      currentParticipants = nextParticipants;
      render();
    },
    unmount: () => {
      reactRoot.unmount();
      root.remove();
    },
  };
}

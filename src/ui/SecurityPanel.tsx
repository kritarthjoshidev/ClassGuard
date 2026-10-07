import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ParticipantState, RiskLevel } from '../core/types';

export interface SecurityPanelProps {
  participantStates?: ParticipantState[];
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
    pointer-events: auto;
  }
  * { box-sizing: border-box; }
  .panel {
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 14px 38px rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(14px);
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 10px 14px;
    background: #0f172a;
    color: white;
  }
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
  .safe { color: #047857; }
  .watch { color: #b45309; }
  .high { color: #b91c1c; }
  .risk { display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; }
  .collapsed .body { display: none; }
  .collapsed .header { border-radius: 14px 14px 0 0; }
`;

function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'high';
  if (score >= 35) return 'watch';
  return 'safe';
}

export function SecurityPanel({ participantStates = [] }: SecurityPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const safeCount = participantStates.filter((participant) => getRiskLevel(participant.score) === 'safe').length;
  const watchCount = participantStates.filter((participant) => getRiskLevel(participant.score) === 'watch').length;
  const highRiskCount = participantStates.filter((participant) => getRiskLevel(participant.score) === 'high').length;
  const overallRisk = participantStates.reduce((maximum, participant) => Math.max(maximum, participant.score), 0);

  return (
    <section className={collapsed ? 'panel collapsed' : 'panel'} aria-label="ClassGuard security panel">
      <style>{panelStyles}</style>
      <header className="header">
        <div>
          <h2 className="title">🛡 CLASSGUARD</h2>
          <p className="status">Protection: ON</p>
        </div>
        <button
          className="button"
          type="button"
          aria-label={collapsed ? 'Expand security panel' : 'Minimize security panel'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? '+' : '−'}
        </button>
      </header>
      <div className="body">
        <p className="metric"><strong>Participants:</strong> {participantStates.length}</p>
        <div className="counts" aria-label="Participant risk counts">
          <div className="count safe"><strong>{safeCount}</strong>Safe</div>
          <div className="count watch"><strong>{watchCount}</strong>Watch</div>
          <div className="count high"><strong>{highRiskCount}</strong>High Risk</div>
        </div>
        <div className="risk">
          <span>Overall Risk</span>
          <span>{overallRisk}</span>
        </div>
        <p className="metric" style={{ marginTop: 10, marginBottom: 0, fontSize: 10, color: '#64748b' }}>
          {participantStates.length === 0 ? 'Waiting for participant state.' : 'Live participant state.'}
        </p>
      </div>
    </section>
  );
}

export interface SecurityPanelController {
  setParticipants: (participantStates: ParticipantState[]) => void;
  unmount: () => void;
}

export function mountSecurityPanel(root: HTMLElement, participantStates: ParticipantState[] = []): SecurityPanelController {
  const shadowRoot = root.attachShadow({ mode: 'open' });
  const reactRoot = createRoot(shadowRoot);
  let currentParticipants = participantStates;

  const render = (): void => {
    reactRoot.render(
      <React.StrictMode>
        <SecurityPanel participantStates={currentParticipants} />
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

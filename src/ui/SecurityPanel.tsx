import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Participant } from '../adapters/meet/participant-detector';
import { findDisplayNamePairs } from '../adapters/meet/participants';
import { getRiskLevel } from '../core/risk-engine';
import type {
  ChatActivitySummary,
  ChatAnalysisSettings,
  RiskPipelineSnapshot,
  SecurityAlert,
} from '../core/types';
import { DEFAULT_CHAT_ANALYSIS_SETTINGS } from '../core/types';
import type { MonitoringStatus, SecurityPanelActions } from './security-panel-host';

export interface SecurityPanelProps extends SecurityPanelActions {
  participants?: Participant[];
  chatActivity?: ChatActivitySummary;
  riskPipeline?: RiskPipelineSnapshot;
  monitoringEnabled?: boolean;
  monitoringStatus?: MonitoringStatus;
  chatAnalysisSettings?: ChatAnalysisSettings;
}

const emptyRiskPipeline: RiskPipelineSnapshot = {
  participantStates: [],
  unattributedObservationCount: 0,
  unattributedSignalTypes: [],
  unattributedSignalCount: 0,
  securityAlerts: [],
};

const alertCategoryLabels: Record<SecurityAlert['category'], string> = {
  LINK_SIGNAL: 'Link characteristic',
  PHISHING_INDICATOR: 'Possible phishing pattern',
  CHAT_SPAM: 'Chat spam signal',
  POSSIBLE_HARASSMENT: 'Possible hostile language',
  PARTICIPANT_ACTIVITY: 'Participant observation',
};

const panelStyles = `
  :host {
    all: initial;
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    width: min(340px, calc(100vw - 24px));
    color: #172033;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: none;
    color-scheme: light;
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, input, textarea { font: inherit; }
  .panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: min(340px, calc(100vw - 24px));
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #cbd5e1;
    border-radius: 16px;
    background: #f8fafc;
    box-shadow: 0 16px 44px rgba(15, 23, 42, .28);
    pointer-events: auto;
  }
  .header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background: #111a2e;
    color: white;
    touch-action: none;
    user-select: none;
    cursor: grab;
  }
  .header:active { cursor: grabbing; }
  .title { margin: 0; font-size: 14px; font-weight: 800; letter-spacing: .04em; }
  .status { margin: 4px 0 0; color: #d6deea; font-size: 11px; }
  .button {
    border: 1px solid #94a3b8;
    border-radius: 9px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 6px 9px;
  }
  .header .button { color: white; }
  .button:hover { background: #e2e8f0; color: #111827; }
  .header .button:hover { background: rgba(255,255,255,.14); color: white; }
  .button:focus-visible, input:focus-visible, textarea:focus-visible, summary:focus-visible {
    outline: 3px solid #2563eb;
    outline-offset: 2px;
  }
  .body { overflow-y: auto; padding: 12px; }
  .overview { display: grid; gap: 8px; margin-bottom: 10px; }
  .overview-status { margin: 0; font-size: 12px; font-weight: 700; }
  .overview-note { margin: 3px 0 0; color: #475569; font-size: 11px; line-height: 1.4; }
  .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .metric-card { padding: 9px; border: 1px solid #e2e8f0; border-radius: 11px; background: white; }
  .metric-card strong { display: block; font-size: 17px; }
  .metric-card span { color: #475569; font-size: 10px; }
  .section { margin-top: 9px; border: 1px solid #dbe3ed; border-radius: 12px; background: white; }
  .section > summary { padding: 10px 11px; cursor: pointer; font-size: 12px; font-weight: 750; }
  .section-content { padding: 0 10px 10px; }
  .participant-list, .alert-list { display: grid; gap: 7px; }
  .participant, .alert { min-width: 0; padding: 9px; border-radius: 10px; background: #f1f5f9; overflow-wrap: anywhere; }
  .participant-name { display: block; color: #0f172a; font-size: 12px; font-weight: 700; }
  .participant-status, .muted, .alert-evidence, .alert-meta { display: block; margin-top: 4px; color: #475569; font-size: 10px; line-height: 1.4; }
  .alert { border-left: 3px solid #64748b; }
  .alert[data-severity="MEDIUM"], .alert[data-severity="HIGH"] { border-left-color: #b45309; }
  .alert[data-severity="LOW"] { border-left-color: #2563eb; }
  .alert-title { display: block; margin-top: 5px; font-size: 12px; }
  .alert-explanation { margin: 5px 0 0; color: #334155; font-size: 11px; line-height: 1.45; }
  .alert-evidence { padding-left: 15px; }
  .alert-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
  .dismiss { border: 1px solid #94a3b8; border-radius: 8px; background: white; color: #172033; cursor: pointer; padding: 5px 8px; font-size: 10px; }
  .checks { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
  .check { display: flex; align-items: flex-start; gap: 8px; color: #243247; font-size: 11px; line-height: 1.4; }
  .check input { margin-top: 1px; accent-color: #1d4ed8; }
  .expected-form { display: grid; gap: 7px; margin-top: 9px; }
  .expected-form label { font-size: 11px; font-weight: 700; }
  .expected-form textarea { width: 100%; min-height: 52px; resize: vertical; border: 1px solid #94a3b8; border-radius: 8px; padding: 7px; color: #172033; background: white; font-size: 11px; }
  .collapsed .body { display: none; }
  .empty { margin: 0; color: #475569; font-size: 11px; line-height: 1.45; }
  .clear-button { margin-top: 10px; border-color: #b91c1c; color: #991b1b; }
  .clear-button:hover { background: #fee2e2; color: #7f1d1d; }
  @media (max-width: 420px) { :host, .panel { width: calc(100vw - 16px); } }
`;

function normalizeExpectedName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SecurityPanel({
  participants = [],
  chatActivity = { messagesObserved: 0, suspiciousLinks: 0 },
  riskPipeline = emptyRiskPipeline,
  monitoringEnabled = false,
  monitoringStatus = monitoringEnabled ? 'active' : 'paused',
  chatAnalysisSettings = DEFAULT_CHAT_ANALYSIS_SETTINGS,
  onMonitoringChange,
  onClearSession,
  onDismissAlert,
  onSettingsChange,
}: SecurityPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [expectedInput, setExpectedInput] = useState('');
  const [expectedNames, setExpectedNames] = useState<string[]>([]);
  const [expectedError, setExpectedError] = useState('');
  const panelRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const alerts = riskPipeline.securityAlerts ?? [];
  const activeAlerts = alerts.filter((alert) => alert.dismissedAt === undefined);
  const dismissedAlerts = alerts.filter((alert) => alert.dismissedAt !== undefined);
  const participantStates = riskPipeline.participantStates.filter((state) => state.score > 0);
  const namePairs = findDisplayNamePairs(participants);
  const warningByDomKey = new Map<string, string[]>();
  for (const pair of namePairs) {
    const warning = pair.kind === 'duplicate'
      ? 'Duplicate display name observed (weak signal)'
      : 'Similar-looking display name observed (weak signal)';
    for (const key of [pair.left.domKey, pair.right.domKey]) {
      warningByDomKey.set(key, [...(warningByDomKey.get(key) ?? []), warning]);
    }
  }
  const allChecksEnabled = Object.values(chatAnalysisSettings).every(Boolean);
  const overallStatus = monitoringStatus === 'unavailable'
    ? 'Monitoring unavailable'
    : !monitoringEnabled
    ? 'Monitoring paused'
    : activeAlerts.length > 0
      ? 'Review session signals'
      : allChecksEnabled
        ? 'No alerts from enabled rules yet'
        : 'Monitoring with selected checks';

  const clampPosition = (x: number, y: number): { x: number; y: number } => {
    const panelWidth = panelRef.current?.offsetWidth || 340;
    const panelHeight = panelRef.current?.offsetHeight || 420;
    return {
      x: Math.min(Math.max(x, 0), Math.max(0, window.innerWidth - panelWidth)),
      y: Math.min(Math.max(y, 0), Math.max(0, window.innerHeight - panelHeight)),
    };
  };

  useEffect(() => {
    const handleResize = (): void => {
      if (position) setPosition((current) => current ? clampPosition(current.x, current.y) : current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  const beginDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || !(panelRef.current && headerRef.current)) return;
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    dragging.current = true;
    headerRef.current.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (!dragging.current) return;
    setPosition(clampPosition(event.clientX - dragOffset.current.x, event.clientY - dragOffset.current.y));
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (!dragging.current) return;
    dragging.current = false;
    const header = headerRef.current;
    if (header?.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
  };

  const saveExpectedNames = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const names = [...new Set(expectedInput.split(/[\n,]+/).map((name) => name.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    if (names.some((name) => name.length > 80) || names.length > 50) {
      setExpectedError('Use up to 50 names, each 80 characters or fewer.');
      return;
    }
    setExpectedError('');
    setExpectedNames(names);
  };

  const updateSetting = (key: keyof ChatAnalysisSettings, checked: boolean): void => {
    onSettingsChange?.({ ...chatAnalysisSettings, [key]: checked });
  };

  const renderAlert = (alert: SecurityAlert, dismissed = false): React.ReactNode => (
    <article className="alert" data-severity={alert.severity} key={alert.id}>
      <span className="alert-meta">{alert.severity} · {alertCategoryLabels[alert.category]} · {formatTime(alert.detectedAt)}</span>
      <strong className="alert-title">{alert.title}</strong>
      <p className="alert-explanation">{alert.explanation}</p>
      {alert.evidence.length > 0 && (
        <ul className="alert-evidence">
          {alert.evidence.map((item, index) => <li key={`${alert.id}:evidence:${index}`}>{item}</li>)}
        </ul>
      )}
      {alert.category !== 'PARTICIPANT_ACTIVITY' && (
        <span className="alert-meta">
          {alert.attribution === 'verified' && alert.participantName
            ? `Observed participant: ${alert.participantName}`
            : 'Unknown sender · no participant score assigned'}
        </span>
      )}
      {onDismissAlert && !dismissed && (
        <div className="alert-actions">
          <span className="alert-meta">Evidence strength: {alert.evidenceStrength}</span>
          <button className="dismiss" type="button" onClick={() => onDismissAlert(alert.id)} aria-label={`Dismiss ${alert.title}`}>
            Dismiss
          </button>
        </div>
      )}
      {dismissed && <span className="alert-meta">Dismissed {alert.dismissedAt ? formatTime(alert.dismissedAt) : ''}; kept in session history.</span>}
    </article>
  );

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
          <p className="status">Local monitoring: {monitoringStatus === 'active' ? 'ON' : monitoringStatus === 'paused' ? 'PAUSED' : 'UNAVAILABLE'}</p>
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
        <section className="overview" aria-label="Session overview">
          <div>
            <p className="overview-status" role="status" aria-live="polite">{overallStatus}</p>
            <p className="overview-note">Session-local checks. Chat senders are unverified unless the UI provides reliable attribution.</p>
          </div>
          <div className="metrics">
            <div className="metric-card"><strong>{participants.length}</strong><span>Participants visible</span></div>
            <div className="metric-card"><strong>{chatActivity.messagesObserved}</strong><span>Messages observed</span></div>
            <div className="metric-card"><strong>{activeAlerts.length}</strong><span>Active signals</span></div>
            <div className="metric-card"><strong>{activeAlerts.filter((alert) => alert.severity === 'MEDIUM' || alert.severity === 'HIGH').length}</strong><span>Need review</span></div>
          </div>
          {participantStates.map((state) => (
            <p className="overview-note" key={state.participantName}>
              Risk score for {state.participantName}: {state.score} ({getRiskLevel(state.score)}). Only explicitly attributed events contribute.
            </p>
          ))}
          {riskPipeline.unattributedSignalCount ? (
            <p className="overview-note">Unattributed risk signals: {riskPipeline.unattributedSignalCount}; no participant score was changed.</p>
          ) : null}
        </section>

        <details className="section" open>
          <summary>Participants ({participants.length})</summary>
          <div className="section-content">
            {participants.length === 0
              ? <p className="empty">Waiting for participant rows exposed by the current Meet DOM.</p>
              : <div className="participant-list">
                {participants.map((participant) => {
                  const isExpected = expectedNames.some((name) => normalizeExpectedName(name) === normalizeExpectedName(participant.participantName));
                  const warnings = warningByDomKey.get(participant.domKey) ?? [];
                  return (
                    <div className="participant" key={participant.domKey}>
                      <span className="participant-name">{participant.participantName}</span>
                      <span className="participant-status">
                        {expectedNames.length === 0 ? 'Identity unverified'
                          : isExpected ? 'Display name matches your session list'
                            : 'Display name is not in your session list'}
                      </span>
                      {warnings.map((warning) => <span className="participant-status" key={warning}>{warning}</span>)}
                    </div>
                  );
                })}
              </div>}
            <form className="expected-form" onSubmit={saveExpectedNames}>
              <label htmlFor="classguard-expected-names">Optional expected display names (session only)</label>
              <textarea
                id="classguard-expected-names"
                value={expectedInput}
                onChange={(event) => setExpectedInput(event.currentTarget.value)}
                placeholder="One name per line"
                maxLength={4_100}
              />
              <button className="dismiss" type="submit">Compare names</button>
              {expectedError && <span role="alert" className="participant-status">{expectedError}</span>}
              {expectedNames.length > 0 && <span className="participant-status">Names are compared as display labels only; a match does not verify identity.</span>}
            </form>
          </div>
        </details>

        <details className="section" open>
          <summary>Security signals ({activeAlerts.length})</summary>
          <div className="section-content">
            {activeAlerts.length === 0
              ? <p className="empty">{monitoringStatus === 'active'
                ? 'No alerts from the currently enabled local rules yet. This does not establish that a message or participant is safe.'
                : monitoringStatus === 'paused'
                  ? 'Monitoring is paused. New messages and participant changes are not being checked.'
                  : 'Monitoring could not start. No security checks are currently running.'}</p>
              : <div className="alert-list">{activeAlerts.slice().reverse().map((alert) => renderAlert(alert))}</div>}
          </div>
        </details>

        {dismissedAlerts.length > 0 && (
          <details className="section">
            <summary>Dismissed signals ({dismissedAlerts.length})</summary>
            <div className="section-content"><div className="alert-list">{dismissedAlerts.slice().reverse().map((alert) => renderAlert(alert, true))}</div></div>
          </details>
        )}

        <details className="section">
          <summary>Detection checks</summary>
          <div className="section-content">
            {onSettingsChange ? (
              <fieldset className="checks">
                <legend className="muted">Turn local signal categories on or off</legend>
                <label className="check"><input type="checkbox" checked={chatAnalysisSettings.linkSignals} onChange={(event) => updateSetting('linkSignals', event.currentTarget.checked)} /> URL characteristics</label>
                <label className="check"><input type="checkbox" checked={chatAnalysisSettings.phishingIndicators} onChange={(event) => updateSetting('phishingIndicators', event.currentTarget.checked)} /> Phishing and pressure wording</label>
                <label className="check"><input type="checkbox" checked={chatAnalysisSettings.spamSignals} onChange={(event) => updateSetting('spamSignals', event.currentTarget.checked)} /> Repeated messages and bursts</label>
                <label className="check"><input type="checkbox" checked={chatAnalysisSettings.abusiveLanguage} onChange={(event) => updateSetting('abusiveLanguage', event.currentTarget.checked)} /> Possible hostile language</label>
              </fieldset>
            ) : <p className="empty">Detection controls are unavailable in this panel instance.</p>}
          </div>
        </details>

        <details className="section">
          <summary>Participant risk and link counts</summary>
          <div className="section-content">
            <p className="empty">Chat events are unattributed and do not increase participant risk. A shortener or URL pattern is a review signal, not proof of malicious intent.</p>
            <p className="muted">URL characteristic observations: {chatActivity.suspiciousLinks}</p>
            {participantStates.length === 0
              ? <p className="muted">No explicitly attributed participant risk score is currently recorded.</p>
              : participantStates.map((state) => (
                <p className="muted" key={state.participantName}>{state.participantName}: {state.score} · {state.reasons.join(', ')}</p>
              ))}
          </div>
        </details>

        {onMonitoringChange && (
          <button
            className="dismiss"
            type="button"
            aria-pressed={monitoringEnabled}
            onClick={() => onMonitoringChange(!monitoringEnabled)}
            style={{ marginTop: 10, width: '100%', padding: 8 }}
          >
            {monitoringEnabled ? 'Pause monitoring' : 'Resume monitoring'}
          </button>
        )}
        {onClearSession && (
          <button className="dismiss clear-button" type="button" onClick={() => {
            if (window.confirm('Clear this meeting’s in-memory observations and alert history?')) {
              setExpectedInput('');
              setExpectedNames([]);
              setExpectedError('');
              onClearSession();
            }
          }} style={{ width: '100%', padding: 8 }}>
            Clear this session
          </button>
        )}
        <p className="muted">Message text is analyzed locally and not stored in alert history or browser storage.</p>
      </div>
    </section>
  );
}

export interface SecurityPanelController {
  setParticipants: (participants: Participant[]) => void;
  setChatActivity: (activity: ChatActivitySummary) => void;
  setRiskPipeline: (snapshot: RiskPipelineSnapshot) => void;
  setMonitoringEnabled: (enabled: boolean) => void;
  setMonitoringStatus: (status: MonitoringStatus) => void;
  setChatAnalysisSettings: (settings: ChatAnalysisSettings) => void;
  unmount: () => void;
}

export function mountSecurityPanel(
  root: HTMLElement,
  participants: Participant[] = [],
  chatActivity: ChatActivitySummary = { messagesObserved: 0, suspiciousLinks: 0 },
  riskPipeline: RiskPipelineSnapshot = emptyRiskPipeline,
  monitoringEnabled = false,
  chatAnalysisSettings: ChatAnalysisSettings = DEFAULT_CHAT_ANALYSIS_SETTINGS,
  actions: SecurityPanelActions = {},
  monitoringStatus: MonitoringStatus = monitoringEnabled ? 'active' : 'paused',
): SecurityPanelController {
  const shadowRoot = root.shadowRoot ?? root.attachShadow({ mode: 'open' });
  const reactRoot = createRoot(shadowRoot);
  let currentParticipants = participants;
  let currentChatActivity = chatActivity;
  let currentRiskPipeline = riskPipeline;
  let currentMonitoringEnabled = monitoringEnabled;
  let currentMonitoringStatus = monitoringStatus;
  let currentSettings = chatAnalysisSettings;

  const render = (): void => {
    reactRoot.render(
      <React.StrictMode>
        <SecurityPanel
          participants={currentParticipants}
          chatActivity={currentChatActivity}
          riskPipeline={currentRiskPipeline}
          monitoringEnabled={currentMonitoringEnabled}
          monitoringStatus={currentMonitoringStatus}
          chatAnalysisSettings={currentSettings}
          {...actions}
        />
      </React.StrictMode>,
    );
  };

  render();

  return {
    setParticipants: (nextParticipants) => {
      currentParticipants = nextParticipants;
      render();
    },
    setChatActivity: (nextActivity) => {
      currentChatActivity = nextActivity;
      render();
    },
    setRiskPipeline: (snapshot) => {
      currentRiskPipeline = snapshot;
      render();
    },
    setMonitoringEnabled: (enabled) => {
      currentMonitoringEnabled = enabled;
      currentMonitoringStatus = enabled ? 'active' : 'paused';
      render();
    },
    setMonitoringStatus: (status) => {
      currentMonitoringStatus = status;
      currentMonitoringEnabled = status === 'active';
      render();
    },
    setChatAnalysisSettings: (settings) => {
      currentSettings = settings;
      render();
    },
    unmount: () => {
      reactRoot.unmount();
      root.remove();
    },
  };
}

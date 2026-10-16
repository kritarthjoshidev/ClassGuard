import { findDisplayNamePairs } from '../adapters/meet/participants';
import { MeetAdapter } from '../adapters/meet/meet-adapter';
import { EventPipeline } from '../core/event-pipeline';
import { DEFAULT_CHAT_ANALYSIS_SETTINGS, type ChatAnalysisSettings } from '../core/types';
import { displayNamePairToAlert, participantObservationToAlert } from '../core/participant-intelligence';
import { SecurityPanelHost } from '../ui/security-panel-host';
import { isActiveGoogleMeetUrl } from './meeting-detection';

const chatActivity = { messagesObserved: 0, suspiciousLinks: 0 };
let chatSettings: ChatAnalysisSettings = { ...DEFAULT_CHAT_ANALYSIS_SETTINGS };
let monitoringEnabled = false;
let adapter: MeetAdapter | null = null;

const eventPipeline = new EventPipeline((snapshot) => panelHost.setRiskPipeline(snapshot));
const panelHost = new SecurityPanelHost({
  onMonitoringChange: (enabled) => setMonitoring(enabled),
  onClearSession: clearSession,
  onDismissAlert: (alertId) => eventPipeline.dismissAlert(alertId),
  onSettingsChange: (settings) => {
    chatSettings = { ...settings };
    adapter?.setChatAnalysisSettings(chatSettings);
    panelHost.setChatAnalysisSettings(chatSettings);
  },
});

adapter = new MeetAdapter(
  document,
  (participants) => {
    panelHost.setParticipants(participants);
    for (const pair of findDisplayNamePairs(participants)) {
      eventPipeline.addAlert(displayNamePairToAlert(pair));
    }
  },
  (event) => {
    eventPipeline.handleEvent(event);
    if (event.type === 'CHAT_MESSAGE') chatActivity.messagesObserved += 1;
    if (event.type === 'SUSPICIOUS_LINK') chatActivity.suspiciousLinks += 1;
    panelHost.setChatActivity({ ...chatActivity });
  },
  (observations) => {
    for (const observation of observations) {
      eventPipeline.addAlert(participantObservationToAlert(observation));
    }
  },
);
adapter.setChatAnalysisSettings(chatSettings);

function emit(message: string): void {
  console.info(`[ClassGuard] ${message}`);
}

function setMonitoring(enabled: boolean): void {
  if (!adapter) return;
  if (!enabled) {
    adapter.stop();
    monitoringEnabled = false;
    panelHost.setParticipants([]);
    panelHost.setMonitoringStatus('paused');
    return;
  }

  try {
    adapter.start();
    monitoringEnabled = adapter.isRunning;
    panelHost.setMonitoringStatus(monitoringEnabled ? 'active' : 'unavailable');
  } catch {
    adapter.stop();
    monitoringEnabled = false;
    panelHost.setMonitoringStatus('unavailable');
  }
}

function clearSession(): void {
  const resumeAfterClear = monitoringEnabled;
  adapter?.stop();
  monitoringEnabled = false;
  eventPipeline.clear();
  chatActivity.messagesObserved = 0;
  chatActivity.suspiciousLinks = 0;
  panelHost.setChatActivity({ ...chatActivity });
  panelHost.setParticipants([]);
  if (resumeAfterClear) setMonitoring(true);
}

function stopForNavigation(): void {
  adapter?.stop();
  monitoringEnabled = false;
  eventPipeline.clear();
  chatActivity.messagesObserved = 0;
  chatActivity.suspiciousLinks = 0;
  panelHost.setChatActivity({ ...chatActivity });
  panelHost.setParticipants([]);
  panelHost.setMonitoringStatus('paused');
  panelHost.remove();
}

function initialize(): void {
  if (!isActiveGoogleMeetUrl(window.location.href) || !adapter) return;
  panelHost.mount();
  setMonitoring(true);
  if (monitoringEnabled) emit('Local monitoring started');
  else emit('Monitoring unavailable: Meet DOM observers could not start');
}

function handleHistoryNavigation(): void {
  if (isActiveGoogleMeetUrl(window.location.href)) initialize();
  else stopForNavigation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

window.addEventListener('pagehide', stopForNavigation);
window.addEventListener('popstate', handleHistoryNavigation);
window.addEventListener('pageshow', handleHistoryNavigation);

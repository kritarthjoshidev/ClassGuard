import type { Participant } from '../adapters/meet/participant-detector';
import type { ChatActivitySummary, ChatAnalysisSettings, RiskPipelineSnapshot } from '../core/types';
import { DEFAULT_CHAT_ANALYSIS_SETTINGS } from '../core/types';
import { mountSecurityPanel } from './SecurityPanel';

export interface SecurityPanelActions {
  onMonitoringChange?: (enabled: boolean) => void;
  onClearSession?: () => void;
  onDismissAlert?: (alertId: string) => void;
  onSettingsChange?: (settings: ChatAnalysisSettings) => void;
}

export type MonitoringStatus = 'active' | 'paused' | 'unavailable';

export class SecurityPanelHost {
  private readonly host = document.createElement('div');
  private readonly mountTarget = document.createElement('div');
  private panelController: ReturnType<typeof mountSecurityPanel> | null = null;
  private chatActivity: ChatActivitySummary = { messagesObserved: 0, suspiciousLinks: 0 };
  private riskPipeline: RiskPipelineSnapshot = {
    participantStates: [],
    unattributedObservationCount: 0,
    unattributedSignalTypes: [],
    unattributedSignalCount: 0,
    securityAlerts: [],
  };
  private monitoringStatus: MonitoringStatus = 'paused';
  private chatAnalysisSettings: ChatAnalysisSettings = { ...DEFAULT_CHAT_ANALYSIS_SETTINGS };

  constructor(private actions: SecurityPanelActions = {}) {
    this.host.setAttribute('data-classguard-security-panel', 'true');
    this.host.style.position = 'fixed';
    this.host.style.inset = '0';
    this.host.style.zIndex = '2147483647';
    this.host.style.pointerEvents = 'none';
    this.mountTarget.style.position = 'fixed';
    this.mountTarget.style.top = '0';
    this.mountTarget.style.right = '0';
    this.mountTarget.style.width = '0';
    this.mountTarget.style.height = '0';
    this.mountTarget.style.pointerEvents = 'auto';
    this.host.appendChild(this.mountTarget);
  }

  mount(): void {
    if (this.panelController) return;
    if (this.mountTarget.parentElement !== this.host) this.host.appendChild(this.mountTarget);
    document.body.appendChild(this.host);
    this.panelController = mountSecurityPanel(
      this.mountTarget,
      [],
      this.chatActivity,
      this.riskPipeline,
      this.monitoringStatus === 'active',
      this.chatAnalysisSettings,
      this.actions,
      this.monitoringStatus,
    );
  }

  setParticipants(participants: Participant[]): void {
    this.panelController?.setParticipants(participants);
  }

  setChatActivity(activity: ChatActivitySummary): void {
    this.chatActivity = activity;
    this.panelController?.setChatActivity(activity);
  }

  setRiskPipeline(snapshot: RiskPipelineSnapshot): void {
    this.riskPipeline = snapshot;
    this.panelController?.setRiskPipeline(snapshot);
  }

  setMonitoringEnabled(enabled: boolean): void {
    this.monitoringStatus = enabled ? 'active' : 'paused';
    this.panelController?.setMonitoringStatus(this.monitoringStatus);
  }

  setMonitoringStatus(status: MonitoringStatus): void {
    this.monitoringStatus = status;
    this.panelController?.setMonitoringEnabled(status === 'active');
    this.panelController?.setMonitoringStatus(status);
  }

  setChatAnalysisSettings(settings: ChatAnalysisSettings): void {
    this.chatAnalysisSettings = { ...settings };
    this.panelController?.setChatAnalysisSettings(this.chatAnalysisSettings);
  }

  setActions(actions: SecurityPanelActions): void {
    this.actions = actions;
  }

  remove(): void {
    this.panelController?.unmount();
    this.panelController = null;
    this.host.remove();
  }
}

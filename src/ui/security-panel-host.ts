import type { Participant } from '../adapters/meet/participant-detector';
import type { ChatActivitySummary, RiskPipelineSnapshot } from '../core/types';
import { mountSecurityPanel } from './SecurityPanel';

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
  };

  constructor() {
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
    document.body.appendChild(this.host);
    this.panelController = mountSecurityPanel(this.mountTarget, [], this.chatActivity, this.riskPipeline);
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

  remove(): void {
    this.panelController?.unmount();
    this.panelController = null;
    this.host.remove();
  }
}

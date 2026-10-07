import type { Participant } from '../adapters/meet/participant-detector';
import { mountSecurityPanel } from './SecurityPanel';

export class SecurityPanelHost {
  private readonly host = document.createElement('div');
  private readonly mountTarget = document.createElement('div');
  private panelController: ReturnType<typeof mountSecurityPanel> | null = null;

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
    this.panelController = mountSecurityPanel(this.mountTarget);
  }

  setParticipants(participants: Participant[]): void {
    this.panelController?.setParticipants(participants);
  }

  remove(): void {
    this.panelController?.unmount();
    this.panelController = null;
    this.host.remove();
  }
}

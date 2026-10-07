import { mountSecurityPanel } from './SecurityPanel';

import type { ParticipantState } from '../core/types';

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
    this.mountTarget.style.pointerEvents = 'none';
    this.host.appendChild(this.mountTarget);
  }

  mount(): void {
    if (this.panelController) return;
    document.body.appendChild(this.host);
    this.panelController = mountSecurityPanel(this.mountTarget);
  }

  setParticipants(participants: ParticipantState[]): void {
    this.panelController?.setParticipants(participants);
  }

  remove(): void {
    this.panelController?.unmount();
    this.panelController = null;
    this.host.remove();
  }
}

import { mountSecurityPanel } from './SecurityPanel';

export class SecurityPanelHost {
  private readonly host = document.createElement('div');
  private readonly mountTarget = document.createElement('div');
  private unmount: (() => void) | null = null;

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
    if (this.unmount) return;
    document.body.appendChild(this.host);
    this.unmount = mountSecurityPanel(this.mountTarget);
  }

  remove(): void {
    this.unmount?.();
    this.unmount = null;
    this.host.remove();
  }
}

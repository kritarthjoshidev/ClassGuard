import type { NormalizedEvent } from '../../core/types';

export class MeetAdapter {
  private observer: MutationObserver | null = null;
  private scanTimer: number | null = null;

  constructor(private readonly root: Document) {}

  detectMeeting(): boolean {
    return new URL(window.location.href).hostname.includes('meet.google.com');
  }

  start(): void {
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(this.root.documentElement, { childList: true, subtree: true, attributes: true });
    this.scheduleScan();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  emit(event: NormalizedEvent): void {
    // Future adapters should call this only after a real observable signal is verified.
    void event;
  }

  private scheduleScan(): void {
    if (this.scanTimer !== null) return;
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null;
      this.scan();
    }, 500);
  }

  private scan(): void {
    // No synthetic events are emitted from page structure alone.
  }
}

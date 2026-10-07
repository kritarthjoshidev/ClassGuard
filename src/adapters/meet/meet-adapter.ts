import type { NormalizedEvent } from '../../core/types';

export class MeetAdapter {
  private observer: MutationObserver | null = null;
  private eventCount = 0;

  constructor(private readonly root: Document) {}

  detectMeeting(): boolean {
    return new URL(window.location.href).hostname.includes('meet.google.com');
  }

  start(): void {
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(this.root.documentElement, { childList: true, subtree: true, attributes: true });
    this.scan();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private scan(): void {
    this.eventCount += 1;
    const message = this.root.querySelector('[aria-label*="Chat"], [data-tooltip*="Chat"]');
    if (message) {
      const event: NormalizedEvent = {
        type: 'CHAT_MESSAGE',
        participantName: 'ObservedParticipant',
        timestamp: Date.now(),
        metadata: { observedAtMutation: this.eventCount },
      };
      chrome.storage.local.set({ lastEvent: event });
    }
  }
}

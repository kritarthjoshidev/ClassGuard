import { PARTICIPANT_SELECTOR } from './selectors';

export interface DetectedParticipant {
  id: string;
  name: string;
}

export type ParticipantChangeHandler = (participants: DetectedParticipant[]) => void;

export class ParticipantDetector {
  private readonly observer: MutationObserver;
  private active = false;

  constructor(
    private readonly root: Document,
    private readonly onParticipantsChange: ParticipantChangeHandler,
  ) {
    this.observer = new MutationObserver(() => this.refresh());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.refresh();
    this.observer.observe(this.root.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.observer.disconnect();
  }

  refresh(): void {
    const participants = new Map<string, DetectedParticipant>();

    for (const element of this.root.querySelectorAll<HTMLElement>(PARTICIPANT_SELECTOR)) {
      const id = element.dataset.participantId?.trim();
      if (!id) continue;

      const name = element.getAttribute('aria-label')?.trim()
        || element.textContent?.trim()
        || id;
      participants.set(id, { id, name });
    }

    this.onParticipantsChange([...participants.values()]);
  }
}

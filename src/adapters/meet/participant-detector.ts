import { PARTICIPANT_SELECTOR } from './selectors';

/**
 * Observable UI state only. A participant name is not a persistent identity,
 * account ID, email address, or Google account identifier.
 */
export interface Participant {
  participantName: string;
  observedAt: number;
}

export type ParticipantChangeHandler = (participants: Participant[]) => void;

const NON_PARTICIPANT_LABELS = new Set([
  'chat',
  'participants',
  'people',
  'more options',
  'settings',
  'classguard',
]);

function normalizeParticipantName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isNonParticipantLabel(value: string): boolean {
  const normalized = value.toLowerCase();
  return [...NON_PARTICIPANT_LABELS].some(
    (label) => normalized === label || normalized.startsWith(`${label}:`),
  );
}

export class ParticipantDetector {
  private readonly observer: MutationObserver;
  private readonly debounceMs = 150;
  private readonly onParticipantsChange: ParticipantChangeHandler;
  private active = false;
  private refreshTimer: number | null = null;
  private previousSnapshot: string[] | null = null;

  constructor(private readonly root: Document, onParticipantsChange: ParticipantChangeHandler) {
    this.onParticipantsChange = onParticipantsChange;
    this.observer = new MutationObserver(() => this.scheduleRefresh());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.observer.observe(this.root.documentElement, {
      childList: true,
      subtree: true,
    });
    this.scheduleRefresh();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.observer.disconnect();
  }

  private scheduleRefresh(): void {
    if (!this.active) return;
    if (this.refreshTimer !== null) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh();
    }, this.debounceMs);
  }

  private refresh(): void {
    const nextParticipants = this.extractParticipants();
    const nextSnapshot = nextParticipants
      .map((participant) => participant.participantName)
      .sort((left, right) => left.localeCompare(right));
    const previousSnapshot = this.previousSnapshot
      ? [...this.previousSnapshot].sort((left, right) => left.localeCompare(right))
      : null;

    if (previousSnapshot && JSON.stringify(nextSnapshot) === JSON.stringify(previousSnapshot)) return;

    this.previousSnapshot = nextSnapshot;
    this.onParticipantsChange(nextParticipants);
  }

  private extractParticipants(): Participant[] {
    const participants = new Map<string, Participant>();
    const observedAt = Date.now();

    for (const element of this.root.querySelectorAll<HTMLElement>(PARTICIPANT_SELECTOR)) {
      const domKey = element.dataset.participantId?.trim();
      const name = normalizeParticipantName(
        element.getAttribute('aria-label')?.trim()
          || element.textContent?.trim()
          || '',
      );

      if (!name || !domKey || isNonParticipantLabel(name)) continue;
      participants.set(name.toLocaleLowerCase(), {
        participantName: name,
        observedAt,
      });
    }

    return [...participants.values()].sort((left, right) =>
      left.participantName.localeCompare(right.participantName),
    );
  }
}
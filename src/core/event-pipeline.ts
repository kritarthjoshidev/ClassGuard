import { applyEvent, getEventScore } from './risk-engine';
import type { EventType, NormalizedEvent, ParticipantState, RiskPipelineSnapshot } from './types';

const UNKNOWN_PARTICIPANT = 'unknown participant';

export interface VerifiedParticipantAttribution {
  /** A session-scoped key from the detector that verified the event sender. */
  participantKey: string;
  participantName: string;
}

/** Session-only event routing. Unverified senders never become participant state keys. */
export class EventPipeline {
  private readonly participantStates = new Map<string, ParticipantState>();
  private unattributedObservationCount = 0;
  private readonly unattributedSignalCounts = new Map<EventType, number>();
  private readonly onSnapshot: (snapshot: RiskPipelineSnapshot) => void;

  constructor(onSnapshot: (snapshot: RiskPipelineSnapshot) => void = () => undefined) {
    this.onSnapshot = onSnapshot;
  }

  handleEvent(event: NormalizedEvent): void {
    // A display name in a normalized event is not proof of who sent it.
    this.recordUnattributed({ ...event, participantName: 'Unknown participant' });
  }

  /**
   * Use only when a detector has independently verified the event-to-participant
   * link. The current Meet chat detector has no such sender source.
   */
  handleAttributedEvent(event: NormalizedEvent, attribution: VerifiedParticipantAttribution): void {
    const participantKey = attribution.participantKey.trim();
    const participantName = attribution.participantName.trim();
    if (
      !participantKey
      || !participantName
      || participantName.toLocaleLowerCase() === UNKNOWN_PARTICIPANT
    ) {
      this.handleEvent(event);
      return;
    }

    const existing = this.participantStates.get(participantKey) ?? {
      participantName,
      score: 0,
      reasons: [],
      events: [],
      lastUpdated: 0,
    };
    this.participantStates.set(participantKey, applyEvent(existing, { ...event, participantName }));
    this.onSnapshot(this.getSnapshot());
  }

  private recordUnattributed(event: NormalizedEvent): void {
    this.unattributedObservationCount += 1;
    if (getEventScore(event) > 0) {
      this.unattributedSignalCounts.set(
        event.type,
        (this.unattributedSignalCounts.get(event.type) ?? 0) + 1,
      );
    }
    this.onSnapshot(this.getSnapshot());
  }

  getSnapshot(): RiskPipelineSnapshot {
    const unattributedSignalCount = [...this.unattributedSignalCounts.values()]
      .reduce((total, count) => total + count, 0);
    return {
      participantStates: [...this.participantStates.values()].map((state) => ({
        ...state,
        reasons: [...state.reasons],
        events: [...state.events],
      })),
      unattributedObservationCount: this.unattributedObservationCount,
      unattributedSignalTypes: [...this.unattributedSignalCounts.keys()],
      unattributedSignalCount,
    };
  }
}

import { applyEvent, decayRisk, getEventScore } from './risk-engine';
import type { EventType, NormalizedEvent, ParticipantState, RiskPipelineSnapshot, SecurityAlert } from './types';

const UNKNOWN_PARTICIPANT = 'unknown participant';
const MAX_ALERT_HISTORY = 100;
const MAX_DEDUPLICATION_KEYS = 2_000;
const MAX_PARTICIPANT_STATES = 100;

export interface VerifiedParticipantAttribution {
  /** A session-scoped key from the detector that verified the event sender. */
  participantKey: string;
  participantName: string;
}

/** Session-only event routing. Unverified senders never become participant state keys. */
export class EventPipeline {
  private readonly participantStates = new Map<string, ParticipantState>();
  private readonly securityAlerts: SecurityAlert[] = [];
  private readonly alertIds = new Set<string>();
  private readonly eventKeys = new Set<string>();
  private unattributedObservationCount = 0;
  private readonly unattributedSignalCounts = new Map<EventType, number>();
  private readonly onSnapshot: (snapshot: RiskPipelineSnapshot) => void;

  constructor(onSnapshot: (snapshot: RiskPipelineSnapshot) => void = () => undefined) {
    this.onSnapshot = onSnapshot;
  }

  handleEvent(event: NormalizedEvent): void {
    if (this.isDuplicateEvent(event)) return;
    // A display name in a normalized event is not proof of who sent it.
    this.recordUnattributed({ ...event, participantName: 'Unknown participant' });
    for (const alert of event.securityAlerts ?? []) this.storeAlert(alert);
    this.onSnapshot(this.getSnapshot());
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

    if (this.isDuplicateEvent(event)) return;

    const existing = this.participantStates.get(participantKey) ?? {
      participantName,
      score: 0,
      reasons: [],
      events: [],
      lastUpdated: 0,
    };
    if (!this.participantStates.has(participantKey) && this.participantStates.size >= MAX_PARTICIPANT_STATES) {
      const oldestKey = this.participantStates.keys().next().value;
      if (oldestKey) this.participantStates.delete(oldestKey);
    }
    const elapsedMs = existing.lastUpdated > 0 ? Math.max(0, event.timestamp - existing.lastUpdated) : 0;
    const decayedState = {
      ...existing,
      score: decayRisk(existing.score, elapsedMs),
      lastUpdated: Math.max(existing.lastUpdated, event.timestamp),
    };
    this.participantStates.set(participantKey, applyEvent(decayedState, { ...event, participantName }));
    for (const alert of event.securityAlerts ?? []) this.storeAlert({
      ...alert,
      attribution: 'verified',
      participantName,
    });
    this.onSnapshot(this.getSnapshot());
  }

  addAlert(alert: SecurityAlert): void {
    if (!this.storeAlert(alert)) return;
    this.onSnapshot(this.getSnapshot());
  }

  private storeAlert(alert: SecurityAlert): boolean {
    if (this.alertIds.has(alert.id)) return false;
    this.alertIds.add(alert.id);
    this.securityAlerts.push({ ...alert, evidence: [...alert.evidence] });
    while (this.securityAlerts.length > MAX_ALERT_HISTORY) {
      const removed = this.securityAlerts.shift();
      if (removed) this.alertIds.delete(removed.id);
    }
    return true;
  }

  dismissAlert(alertId: string, dismissedAt = Date.now()): void {
    const alert = this.securityAlerts.find((item) => item.id === alertId);
    if (!alert || alert.dismissedAt !== undefined) return;
    alert.dismissedAt = dismissedAt;
    this.onSnapshot(this.getSnapshot());
  }

  clear(): void {
    this.participantStates.clear();
    this.securityAlerts.length = 0;
    this.alertIds.clear();
    this.eventKeys.clear();
    this.unattributedObservationCount = 0;
    this.unattributedSignalCounts.clear();
    this.onSnapshot(this.getSnapshot());
  }

  private isDuplicateEvent(event: NormalizedEvent): boolean {
    if (!event.sourceId) return false;
    const key = `${event.sourceId}:${event.type}`;
    if (this.eventKeys.has(key)) return true;
    this.eventKeys.add(key);
    if (this.eventKeys.size > MAX_DEDUPLICATION_KEYS) {
      const oldest = this.eventKeys.values().next().value;
      if (oldest) this.eventKeys.delete(oldest);
    }
    return false;
  }

  private recordUnattributed(event: NormalizedEvent): void {
    this.unattributedObservationCount += 1;
    if (getEventScore(event) > 0) {
      this.unattributedSignalCounts.set(
        event.type,
        (this.unattributedSignalCounts.get(event.type) ?? 0) + 1,
      );
    }
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
      securityAlerts: this.securityAlerts.map((alert) => ({ ...alert, evidence: [...alert.evidence] })),
    };
  }
}

import { PARTICIPANT_SELECTOR } from './selectors';
import { extractParticipantName } from './participants';

/**
 * Observable UI state only. A participant name is not a persistent identity,
 * account ID, email address, or Google account identifier.
 */
export interface Participant {
  /** Ephemeral DOM row key for this meeting only; never a verified account identity. */
  domKey: string;
  participantName: string;
  observedAt: number;
}

export type ParticipantChangeHandler = (participants: Participant[]) => void;
export type ParticipantObservationHandler = (observations: ParticipantObservation[]) => void;

export interface ParticipantObservation {
  id: string;
  kind: 'joined' | 'left' | 'display-name-changed';
  previousName?: string;
  currentName?: string;
  observedAt: number;
}

const NON_PARTICIPANT_LABELS = new Set([
  'chat',
  'participants',
  'people',
  'more options',
  'settings',
  'classguard',
]);
const MAX_OBSERVED_PARTICIPANTS = 200;
const MAX_PARTICIPANT_NAME_LENGTH = 80;
const MAX_DOM_KEY_LENGTH = 200;
// Meet can briefly unmount/recreate participant rows while rearranging its UI.
// Keep the live count responsive, but only publish lifecycle observations after
// the participant snapshot has remained stable through this quiet period.
const OBSERVATION_SETTLE_MS = 1_000;

function normalizeParticipantName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_PARTICIPANT_NAME_LENGTH);
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
  private readonly onObservation: ParticipantObservationHandler;
  private active = false;
  private refreshTimer: number | null = null;
  private observationTimer: number | null = null;
  private previousSnapshot: string[] | null = null;
  private stableObservationParticipants: Map<string, string> | null = null;
  private observationCandidate: Map<string, string> | null = null;

  constructor(
    private readonly root: Document,
    onParticipantsChange: ParticipantChangeHandler,
    onObservation: ParticipantObservationHandler = () => undefined,
  ) {
    this.onParticipantsChange = onParticipantsChange;
    this.onObservation = onObservation;
    this.observer = new MutationObserver((records) => this.handleMutations(records));
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.observer.observe(this.root.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'data-participant-id'],
      characterData: true,
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
    if (this.observationTimer !== null) {
      window.clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }
    this.observer.disconnect();
    this.previousSnapshot = null;
    this.stableObservationParticipants = null;
    this.observationCandidate = null;
  }

  private scheduleRefresh(): void {
    if (!this.active) return;
    if (this.refreshTimer !== null) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh();
    }, this.debounceMs);
  }

  private handleMutations(records: MutationRecord[]): void {
    if (!this.active) return;

    const hasRelevantMutation = records.some((record) => {
      const isParticipantRelated = (node: Node): boolean => {
        const element = node instanceof Element ? node : node.parentElement;
        return Boolean(element && (
          element.matches(PARTICIPANT_SELECTOR)
          || element.closest(PARTICIPANT_SELECTOR)
          || element.querySelector(PARTICIPANT_SELECTOR)
        ));
      };

      if (record.type === 'childList') {
        return isParticipantRelated(record.target)
          || [...record.addedNodes, ...record.removedNodes].some(isParticipantRelated);
      }
      if (record.type === 'attributes' && record.attributeName === 'data-participant-id') return true;

      const target = record.target instanceof Element
        ? record.target
        : record.target.parentElement;
      return Boolean(target?.closest(PARTICIPANT_SELECTOR));
    });

    if (hasRelevantMutation) this.scheduleRefresh();
  }

  private refresh(): void {
    const nextParticipants = this.extractParticipants();
    const nextByKey = new Map(nextParticipants.map((participant) => [participant.domKey, participant.participantName]));
    const nextSnapshot = [...nextByKey.entries()]
      .map(([key, name]) => `${key}\u0000${name}`)
      .sort((left, right) => left.localeCompare(right));
    const previousSnapshot = this.previousSnapshot;

    if (previousSnapshot && JSON.stringify(nextSnapshot) === JSON.stringify(previousSnapshot)) return;

    if (this.stableObservationParticipants === null) {
      // The initial DOM snapshot is a baseline, not a series of join events.
      this.stableObservationParticipants = new Map(nextByKey);
    } else {
      this.scheduleObservationReconciliation(nextByKey);
    }

    this.previousSnapshot = nextSnapshot;
    this.onParticipantsChange(nextParticipants);
  }

  private scheduleObservationReconciliation(candidate: Map<string, string>): void {
    this.observationCandidate = new Map(candidate);
    if (this.observationTimer !== null) window.clearTimeout(this.observationTimer);
    this.observationTimer = window.setTimeout(() => {
      this.observationTimer = null;
      if (!this.active || !this.observationCandidate || !this.stableObservationParticipants) return;

      const previous = this.stableObservationParticipants;
      const current = this.observationCandidate;
      this.observationCandidate = null;
      this.emitStableObservations(previous, current);
      this.stableObservationParticipants = new Map(current);
    }, OBSERVATION_SETTLE_MS);
  }

  private emitStableObservations(
    previous: Map<string, string>,
    current: Map<string, string>,
  ): void {
    const observedAt = Date.now();
    const observations: ParticipantObservation[] = [];
    const removed = [...previous.entries()].filter(([domKey]) => !current.has(domKey));
    const added = [...current.entries()].filter(([domKey]) => !previous.has(domKey));

    // Meet may replace a row node or its ephemeral DOM key without a person
    // leaving. Pair identical labels only to suppress an unsupported leave/join
    // claim; the detector does not treat this as proof of identity continuity.
    const pairedAddedKeys = new Set<string>();
    const unmatchedRemoved: Array<[string, string]> = [];
    for (const [removedKey, removedName] of removed) {
      const replacement = added.find(([addedKey, addedName]) =>
        !pairedAddedKeys.has(addedKey) && addedName === removedName,
      );
      if (replacement) pairedAddedKeys.add(replacement[0]);
      else unmatchedRemoved.push([removedKey, removedName]);
    }

    for (const [domKey, currentName] of current) {
      const previousName = previous.get(domKey);
      if (previousName !== undefined && previousName !== currentName) {
        observations.push({
          id: `${domKey}:renamed:${observedAt}`,
          kind: 'display-name-changed',
          previousName,
          currentName,
          observedAt,
        });
      }
    }
    for (const [domKey, previousName] of unmatchedRemoved) {
      observations.push({
        id: `${domKey}:left:${observedAt}`,
        kind: 'left',
        previousName,
        observedAt,
      });
    }
    for (const [domKey, currentName] of added) {
      if (pairedAddedKeys.has(domKey)) continue;
      observations.push({
        id: `${domKey}:joined:${observedAt}`,
        kind: 'joined',
        currentName,
        observedAt,
      });
    }

    if (observations.length > 0) this.onObservation(observations);
  }

  private extractParticipants(): Participant[] {
    const participants = new Map<string, Participant>();
    const observedAt = Date.now();

    for (const element of this.root.querySelectorAll<HTMLElement>(PARTICIPANT_SELECTOR)) {
      if (participants.size >= MAX_OBSERVED_PARTICIPANTS) break;
      const domKey = element.dataset.participantId?.trim().slice(0, MAX_DOM_KEY_LENGTH);
      const name = normalizeParticipantName(extractParticipantName(element));

      if (!name || !domKey || isNonParticipantLabel(name)) continue;
      participants.set(domKey, {
        domKey,
        participantName: name,
        observedAt,
      });
    }

    return [...participants.values()].sort((left, right) =>
      left.participantName.localeCompare(right.participantName),
    );
  }
}

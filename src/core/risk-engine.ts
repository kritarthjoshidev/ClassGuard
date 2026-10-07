import type { NormalizedEvent, ParticipantState, RiskLevel } from './types';

const RULES: Record<NormalizedEvent['type'], { score: number; cooldownMs: number }> = {
  CHAT_MESSAGE: { score: 0, cooldownMs: 0 },
  CHAT_SPAM: { score: 25, cooldownMs: 30_000 },
  REJOIN_ANOMALY: { score: 20, cooldownMs: 60_000 },
  MIC_UNMUTE_BURST: { score: 30, cooldownMs: 60_000 },
  SUSPICIOUS_LINK: { score: 30, cooldownMs: 60_000 },
  HOST_WARNING_IGNORED: { score: 20, cooldownMs: 60_000 },
};

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'high';
  if (score >= 35) return 'watch';
  return 'safe';
}

export function shouldEmitAlert(score: number): boolean {
  return score >= 70;
}

export function getEventScore(event: NormalizedEvent): number {
  return RULES[event.type]?.score ?? 0;
}

export function canApplyEvent(event: NormalizedEvent, previousEvents: NormalizedEvent[]): boolean {
  const rule = RULES[event.type];
  if (!rule.score) return true;

  const previous = previousEvents
    .filter((candidate) => candidate.participantName === event.participantName && candidate.type === event.type)
    .sort((left, right) => right.timestamp - left.timestamp)[0];

  return previous === undefined || event.timestamp - previous.timestamp >= rule.cooldownMs;
}

export function calculateRisk(events: NormalizedEvent[], now = Date.now()): number {
  let total = 0;
  const accepted = new Map<string, NormalizedEvent>();

  for (const event of events) {
    if (!canApplyEvent(event, [...accepted.values()])) continue;
    const score = getEventScore(event);
    if (!score) continue;
    accepted.set(`${event.participantName}:${event.type}`, event);
    total += score;
  }

  return Math.min(100, total);
}

export function applyEvent(state: ParticipantState, event: NormalizedEvent): ParticipantState {
  if (!canApplyEvent(event, state.events)) return state;

  const reasons = new Set([...state.reasons, event.type]);
  const score = Math.min(100, state.score + getEventScore(event));
  return {
    ...state,
    score,
    reasons: [...reasons],
    events: [...state.events, event],
    lastUpdated: event.timestamp,
  };
}

export function decayRisk(score: number, elapsedMs: number): number {
  const decayPerMinute = 5;
  const minutes = elapsedMs / 60_000;
  return Math.max(0, score - decayPerMinute * minutes);
}

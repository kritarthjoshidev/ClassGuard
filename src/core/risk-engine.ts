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

export function calculateRisk(events: NormalizedEvent[], now = Date.now()): number {
  const scored = new Map<string, number>();
  let total = 0;

  for (const event of events) {
    const rule = RULES[event.type];
    if (!rule.score) continue;
    const key = `${event.participantName}:${event.type}`;
    const previous = scored.get(key);
    if (previous !== undefined && now - previous < rule.cooldownMs) continue;
    scored.set(key, event.timestamp);
    total += rule.score;
  }

  return Math.min(100, total);
}

export function applyEvent(state: ParticipantState, event: NormalizedEvent): ParticipantState {
  const reasons = new Set([...state.reasons, event.type]);
  const score = Math.min(100, state.score + (RULES[event.type]?.score ?? 0));
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

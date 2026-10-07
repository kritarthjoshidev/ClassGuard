import { decayRisk } from './risk-engine';

export function decayParticipantState(score: number, elapsedMs: number): number {
  return decayRisk(score, elapsedMs);
}

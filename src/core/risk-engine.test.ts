import { describe, expect, it } from 'vitest';
import { calculateRisk, getRiskLevel, shouldEmitAlert } from './risk-engine';

describe('risk engine', () => {
  it('keeps score capped and applies rule cooldowns', () => {
    const events = [
      { type: 'CHAT_SPAM' as const, participantName: 'Unknown123', timestamp: 1, metadata: { messageCount: 7, windowMs: 5000 } },
      { type: 'CHAT_SPAM' as const, participantName: 'Unknown123', timestamp: 2, metadata: { messageCount: 8, windowMs: 5000 } },
    ];
    const score = calculateRisk(events, 1000);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBe(25);
  });

  it('maps scores to expected risk levels', () => {
    expect(getRiskLevel(34)).toBe('safe');
    expect(getRiskLevel(35)).toBe('watch');
    expect(getRiskLevel(70)).toBe('high');
  });

  it('does not auto-kick and only alerts an already high-risk participant', () => {
    expect(shouldEmitAlert(70)).toBe(true);
    expect(shouldEmitAlert(69)).toBe(false);
    expect(shouldEmitAlert(100)).toBe(true);
  });
});

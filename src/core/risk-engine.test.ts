import { describe, expect, it } from 'vitest';
import { applyEvent, calculateRisk, getRiskLevel, shouldEmitAlert } from './risk-engine';

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

  it('applies cooldowns consistently when mutating participant state', () => {
    const firstEvent = { type: 'CHAT_SPAM' as const, participantName: 'Unknown123', timestamp: 1, metadata: {} };
    const secondEvent = { type: 'CHAT_SPAM' as const, participantName: 'Unknown123', timestamp: 2, metadata: {} };
    const initialState = {
      participantName: 'Unknown123',
      score: 0,
      reasons: [],
      events: [],
      lastUpdated: 0,
    };

    const afterFirst = applyEvent(initialState, firstEvent);
    const afterSecond = applyEvent(afterFirst, secondEvent);

    expect(afterFirst.score).toBe(25);
    expect(afterSecond.score).toBe(25);
    expect(afterSecond.events).toHaveLength(1);
  });

  it('allows the same participant event again after its cooldown expires', () => {
    const initialState = {
      participantName: 'Unknown123',
      score: 0,
      reasons: [],
      events: [],
      lastUpdated: 0,
    };
    const firstEvent = { type: 'CHAT_SPAM' as const, participantName: 'Unknown123', timestamp: 1, metadata: {} };
    const expiredEvent = { type: 'CHAT_SPAM' as const, participantName: 'Unknown123', timestamp: 30_001, metadata: {} };

    const afterFirst = applyEvent(initialState, firstEvent);
    const afterCooldown = applyEvent(afterFirst, expiredEvent);

    expect(afterCooldown.score).toBe(50);
    expect(afterCooldown.events).toHaveLength(2);
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

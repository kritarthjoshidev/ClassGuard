import { describe, expect, it } from 'vitest';
import { findDisplayNamePairs } from '../adapters/meet/participants';
import { displayNamePairToAlert, participantObservationToAlert } from './participant-intelligence';

describe('participant intelligence', () => {
  it('flags exact duplicate display labels as weak observations', () => {
    const pairs = findDisplayNamePairs([
      { domKey: 'row-1', participantName: 'Phoenix' },
      { domKey: 'row-2', participantName: ' phoenix ' },
    ]);

    expect(pairs).toHaveLength(1);
    const alert = displayNamePairToAlert(pairs[0], 100);
    expect(alert).toMatchObject({
      category: 'PARTICIPANT_ACTIVITY',
      ruleId: 'participant.duplicate-display-name',
      severity: 'LOW',
      evidenceStrength: 'weak',
    });
    expect(alert.explanation).toContain('does not prove impersonation');
  });

  it('detects a narrow Latin/Cyrillic visual lookalike without treating spelling similarity as identity proof', () => {
    const pairs = findDisplayNamePairs([
      { domKey: 'row-1', participantName: 'Alice' },
      { domKey: 'row-2', participantName: 'Аlice' }, // First character is Cyrillic A.
    ]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].kind).toBe('visually-similar');
    expect(displayNamePairToAlert(pairs[0]).severity).toBe('LOW');
  });

  it('does not call ordinary name differences lookalikes', () => {
    expect(findDisplayNamePairs([
      { domKey: 'row-1', participantName: 'Alice Sharma' },
      { domKey: 'row-2', participantName: 'Alicia Sharma' },
    ])).toEqual([]);
  });

  it('describes participant rename as a display-label change only', () => {
    const alert = participantObservationToAlert({
      id: 'session-row:renamed:1',
      kind: 'display-name-changed',
      previousName: 'Alice',
      currentName: 'Alicia',
      observedAt: 1,
    });

    expect(alert.ruleId).toBe('participant.display-name-changed');
    expect(alert.explanation).toContain('does not prove');
    expect(alert.attribution).toBe('unattributed');
  });
});

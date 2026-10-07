// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipantDetector } from './participant-detector';

describe('ParticipantDetector', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('detects unique participant cards from stable meet DOM attributes', () => {
    document.body.innerHTML = `
      <div data-participant-id="p-1" aria-label="Asha Sharma">
        <span>Asha Sharma</span>
      </div>
      <div data-participant-id="p-2" aria-label="Rohan Verma">
        <span>Rohan Verma</span>
      </div>
      <div data-participant-id="p-1" aria-label="Asha Sharma">
        <span>Asha Sharma</span>
      </div>
    `;

    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);
    detector.start();

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0]).toEqual([
      { id: 'p-1', name: 'Asha Sharma' },
      { id: 'p-2', name: 'Rohan Verma' },
    ]);

    detector.stop();
  });

  it('refreshes when participant DOM nodes are added or removed', () => {
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);
    detector.start();

    const participant = document.createElement('div');
    participant.dataset.participantId = 'p-3';
    participant.setAttribute('aria-label', 'Neha Patel');
    document.body.appendChild(participant);

    vi.waitFor(() => {
      expect(onParticipants).toHaveBeenLastCalledWith([
        { id: 'p-3', name: 'Neha Patel' },
      ]);
    });

    detector.stop();
  });
});

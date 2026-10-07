// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeetAdapter } from './meet-adapter';

describe('MeetAdapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers one participant detector and publishes participant state', () => {
    const onParticipants = vi.fn();
    const adapter = new MeetAdapter(document, onParticipants);
    const participant = document.createElement('div');
    participant.dataset.participantId = 'p-1';
    participant.setAttribute('aria-label', 'Asha Sharma');
    document.body.appendChild(participant);

    adapter.start();
    adapter.start();

    expect(onParticipants).toHaveBeenLastCalledWith([
      {
        participantName: 'Asha Sharma',
        score: 0,
        reasons: [],
        events: [],
        lastUpdated: expect.any(Number),
      },
    ]);

    adapter.stop();
    adapter.stop();
  });
});

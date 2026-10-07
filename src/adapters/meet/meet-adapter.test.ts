// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetAdapter } from './meet-adapter';

describe('MeetAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('starts and stops the participant detector without duplicates', () => {
    const onParticipants = vi.fn();
    const adapter = new MeetAdapter(document, onParticipants);
    const participant = document.createElement('div');
    participant.dataset.participantId = 'p-1';
    participant.setAttribute('aria-label', 'Asha Sharma');
    document.body.appendChild(participant);

    adapter.start();
    adapter.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0]).toEqual([
      { participantName: 'Asha Sharma', observedAt: expect.any(Number) },
    ]);

    adapter.stop();
    adapter.stop();
    document.body.appendChild(participant);
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
  });
});

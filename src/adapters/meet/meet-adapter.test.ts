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
      { domKey: 'p-1', participantName: 'Asha Sharma', observedAt: expect.any(Number) },
    ]);

    adapter.stop();
    adapter.stop();
    document.body.appendChild(participant);
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
  });

  it('updates the participant snapshot on join and leave without emitting security events', async () => {
    const onParticipants = vi.fn();
    const onChatEvent = vi.fn();
    const adapter = new MeetAdapter(document, onParticipants, onChatEvent);
    adapter.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    const participant = document.createElement('div');
    participant.dataset.participantId = 'p-1';
    participant.setAttribute('aria-label', 'Asha Sharma');
    document.body.appendChild(participant);
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    expect(onParticipants.mock.calls.at(-1)?.[0]).toEqual([
      { domKey: 'p-1', participantName: 'Asha Sharma', observedAt: expect.any(Number) },
    ]);

    participant.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    expect(onParticipants.mock.calls.at(-1)?.[0]).toEqual([]);
    expect(onChatEvent).not.toHaveBeenCalled();
    adapter.stop();
  });

  it('records session-scoped join, display-name-change, and leave observations', async () => {
    const onObservations = vi.fn();
    const adapter = new MeetAdapter(document, vi.fn(), vi.fn(), onObservations);
    adapter.start();
    vi.advanceTimersByTime(200);

    const participant = document.createElement('div');
    participant.dataset.participantId = 'row-1';
    participant.setAttribute('aria-label', 'Alice');
    document.body.appendChild(participant);
    await Promise.resolve();
    vi.advanceTimersByTime(1_200);
    expect(onObservations.mock.calls.at(-1)?.[0][0]).toMatchObject({ kind: 'joined', currentName: 'Alice' });

    participant.setAttribute('aria-label', 'Alicia');
    await Promise.resolve();
    vi.advanceTimersByTime(1_200);
    expect(onObservations.mock.calls.at(-1)?.[0][0]).toMatchObject({
      kind: 'display-name-changed',
      previousName: 'Alice',
      currentName: 'Alicia',
    });

    participant.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(1_200);
    expect(onObservations.mock.calls.at(-1)?.[0][0]).toMatchObject({ kind: 'left', previousName: 'Alicia' });
    adapter.stop();
  });

  it('exposes idempotent monitoring status and can stop then restart', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const adapter = new MeetAdapter(document);
    expect(adapter.isRunning).toBe(false);
    adapter.start();
    expect(adapter.isRunning).toBe(true);
    adapter.start();
    expect(observe).toHaveBeenCalledTimes(2);
    adapter.stop();
    expect(adapter.isRunning).toBe(false);
    adapter.start();
    expect(adapter.isRunning).toBe(true);
    adapter.stop();
  });
});

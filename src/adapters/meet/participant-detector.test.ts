// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticipantDetector } from './participant-detector';

function createParticipant(id: string, name: string): HTMLElement {
  const element = document.createElement('div');
  element.dataset.participantId = id;
  element.setAttribute('aria-label', name);
  return element;
}

describe('ParticipantDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('chrome', {
      storage: { local: { set: vi.fn() } },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('detects one observable participant name', () => {
    document.body.appendChild(createParticipant('p-1', 'Alice Sharma'));
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants).toHaveBeenCalledWith([
      { participantName: 'Alice Sharma', observedAt: expect.any(Number) },
    ]);
  });

  it('detects multiple participants', () => {
    document.body.append(
      createParticipant('p-1', 'Alice Sharma'),
      createParticipant('p-2', 'Rohan Verma'),
    );
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0].map((participant: { participantName: string }) => participant.participantName))
      .toEqual(['Alice Sharma', 'Rohan Verma']);
  });

  it('deduplicates duplicate DOM representations by normalized display name', () => {
    document.body.append(
      createParticipant('p-1', 'Alice Sharma'),
      createParticipant('p-1-copy', 'Alice Sharma'),
    );
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledWith([
      { participantName: 'Alice Sharma', observedAt: expect.any(Number) },
    ]);
  });

  it('normalizes whitespace and ignores empty names', () => {
    document.body.append(
      createParticipant('p-1', '  Alice   Sharma  '),
      createParticipant('p-2', '   '),
    );
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledWith([
      { participantName: 'Alice Sharma', observedAt: expect.any(Number) },
    ]);
  });

  it('ignores generic participant UI and non-participant labels', () => {
    const genericParticipants = document.createElement('button');
    genericParticipants.setAttribute('aria-label', 'Participants');
    genericParticipants.setAttribute('data-participant-id', 'not-a-participant');
    const chatLabel = document.createElement('button');
    chatLabel.setAttribute('aria-label', 'Chat');
    chatLabel.setAttribute('data-participant-id', 'not-a-participant');
    document.body.append(genericParticipants, chatLabel);
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledWith([]);
  });

  it('does not emit when the participant snapshot is unchanged', () => {
    document.body.append(createParticipant('p-1', 'Alice Sharma'));
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    const duplicate = createParticipant('p-1-copy', 'Alice Sharma');
    document.body.appendChild(duplicate);
    vi.advanceTimersByTime(200);

    expect(onParticipants).not.toHaveBeenCalled();
  });

  it('emits when a participant is added', async () => {
    document.body.append(createParticipant('p-1', 'Alice Sharma'));
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    document.body.appendChild(createParticipant('p-2', 'Rohan Verma'));
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0].map((participant: { participantName: string }) => participant.participantName))
      .toEqual(['Alice Sharma', 'Rohan Verma']);
  });

  it('emits when a participant is removed', async () => {
    document.body.append(createParticipant('p-1', 'Alice Sharma'));
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    document.querySelector('[data-participant-id="p-1"]')?.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledWith([]);
  });

  it('does not emit when participant ordering changes', () => {
    document.body.append(
      createParticipant('p-1', 'Alice Sharma'),
      createParticipant('p-2', 'Rohan Verma'),
    );
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    document.body.appendChild(document.querySelector('[data-participant-id="p-1"]')!);
    vi.advanceTimersByTime(200);

    expect(onParticipants).not.toHaveBeenCalled();
  });

  it('start is idempotent and stop disconnects the observer', () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    detector.start();
    vi.advanceTimersByTime(200);
    detector.stop();
    detector.stop();

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not refresh after stop when a pending debounce fires', () => {
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    document.body.appendChild(createParticipant('p-1', 'Alice Sharma'));
    detector.stop();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(0);
  });

  it('batches multiple mutations into one refresh', () => {
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);
    detector.start();

    document.body.appendChild(createParticipant('p-1', 'Alice Sharma'));
    document.body.appendChild(createParticipant('p-2', 'Rohan Verma'));
    document.body.appendChild(createParticipant('p-3', 'Neha Patel'));
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0]).toHaveLength(3);
    detector.stop();
  });

  it('does not write to chrome.storage', () => {
    const storageWrite = vi.mocked(globalThis.chrome.storage.local.set);
    const detector = new ParticipantDetector(document, vi.fn());

    detector.start();
    vi.advanceTimersByTime(200);
    detector.stop();

    expect(storageWrite).not.toHaveBeenCalled();
  });
});

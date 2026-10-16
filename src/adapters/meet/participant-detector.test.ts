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
      { domKey: 'p-1', participantName: 'Alice Sharma', observedAt: expect.any(Number) },
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

  it('preserves distinct participant rows with the same display name for weak duplicate-name review', () => {
    document.body.append(
      createParticipant('p-1', 'Alice Sharma'),
      createParticipant('p-1-copy', 'Alice Sharma'),
    );
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants.mock.calls[0][0]).toHaveLength(2);
    expect(onParticipants.mock.calls[0][0].map((participant: { domKey: string; participantName: string }) => [
      participant.domKey,
      participant.participantName,
    ])).toEqual([
      ['p-1', 'Alice Sharma'],
      ['p-1-copy', 'Alice Sharma'],
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
      { domKey: 'p-1', participantName: 'Alice Sharma', observedAt: expect.any(Number) },
    ]);
  });

  it('extracts only the specific nested participant name from a participant card', () => {
    const card = document.createElement('div');
    card.dataset.participantId = 'p-1';
    card.setAttribute(
      'aria-label',
      "frame_person You're continuously framed visual_effects Backgrounds and effects More options for Kritarth joshi",
    );

    const nameElement = document.createElement('div');
    nameElement.dataset.participantName = 'true';
    nameElement.textContent = '  Kritarth joshi  ';
    card.appendChild(nameElement);
    document.body.appendChild(card);

    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledWith([
      { domKey: 'p-1', participantName: 'Kritarth joshi', observedAt: expect.any(Number) },
    ]);
    detector.stop();
  });

  it('extracts a clean display name from generic participant-card descendants', () => {
    const card = document.createElement('div');
    card.dataset.participantId = 'p-1';
    card.textContent = 'frame_person Reframe visual_effects Backgrounds and effects More options for Phoenix';

    const nameElement = document.createElement('span');
    nameElement.textContent = 'Phoenix';
    card.appendChild(nameElement);
    document.body.appendChild(card);

    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledWith([
      { domKey: 'p-1', participantName: 'Phoenix', observedAt: expect.any(Number) },
    ]);
    detector.stop();
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

  it('updates a participant when its existing aria-label changes', async () => {
    const participant = createParticipant('p-1', 'Alice Sharma');
    document.body.appendChild(participant);
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    participant.setAttribute('aria-label', 'Alicia Sharma');
    await Promise.resolve();
    vi.advanceTimersByTime(1_200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0]).toEqual([
      { domKey: 'p-1', participantName: 'Alicia Sharma', observedAt: expect.any(Number) },
    ]);
    detector.stop();
  });

  it('does not report a brief row removal and reappearance as a leave and join', async () => {
    document.body.append(createParticipant('p-1', 'Alice Sharma'));
    const onObservation = vi.fn();
    const detector = new ParticipantDetector(document, vi.fn(), onObservation);

    detector.start();
    vi.advanceTimersByTime(200);
    document.querySelector('[data-participant-id="p-1"]')?.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    // The visible participant snapshot stays responsive while lifecycle signals settle.
    expect(onObservation).not.toHaveBeenCalled();

    document.body.appendChild(createParticipant('p-1', 'Alice Sharma'));
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    vi.advanceTimersByTime(1_000);

    expect(onObservation).not.toHaveBeenCalled();
    detector.stop();
  });

  it('suppresses a same-name DOM row replacement instead of claiming a leave and join', async () => {
    document.body.appendChild(createParticipant('p-1', 'Alice Sharma'));
    const onObservation = vi.fn();
    const detector = new ParticipantDetector(document, vi.fn(), onObservation);

    detector.start();
    vi.advanceTimersByTime(200);

    document.querySelector('[data-participant-id="p-1"]')?.remove();
    document.body.appendChild(createParticipant('p-1-remounted', 'Alice Sharma'));
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    vi.advanceTimersByTime(1_000);

    expect(onObservation).not.toHaveBeenCalled();
    detector.stop();
  });

  it('reports a participant leave only after the row remains absent through the settle window', async () => {
    document.body.appendChild(createParticipant('p-1', 'Alice Sharma'));
    const onObservation = vi.fn();
    const detector = new ParticipantDetector(document, vi.fn(), onObservation);

    detector.start();
    vi.advanceTimersByTime(200);
    document.querySelector('[data-participant-id="p-1"]')?.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onObservation).not.toHaveBeenCalled();
    vi.advanceTimersByTime(949);
    expect(onObservation).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onObservation).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'left', previousName: 'Alice Sharma' }),
      ]),
    );
    detector.stop();
  });

  it('updates a participant when an existing name text node changes', async () => {
    const participant = document.createElement('div');
    participant.dataset.participantId = 'p-1';
    const name = document.createElement('span');
    name.textContent = 'Alice Sharma';
    participant.appendChild(name);
    document.body.appendChild(participant);
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    name.firstChild!.textContent = 'Alicia Sharma';
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0]).toEqual([
      { domKey: 'p-1', participantName: 'Alicia Sharma', observedAt: expect.any(Number) },
    ]);
    detector.stop();
  });

  it('detects an existing element when it gains a participant id', async () => {
    const participant = document.createElement('div');
    participant.setAttribute('aria-label', 'Alice Sharma');
    document.body.appendChild(participant);
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);

    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    participant.dataset.participantId = 'p-1';
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onParticipants).toHaveBeenCalledTimes(1);
    expect(onParticipants.mock.calls[0][0]).toEqual([
      { domKey: 'p-1', participantName: 'Alice Sharma', observedAt: expect.any(Number) },
    ]);
    detector.stop();
  });

  it('records a display-label change without treating the name as an identity', async () => {
    const participant = createParticipant('p-1', 'Alice Sharma');
    document.body.appendChild(participant);
    const onParticipants = vi.fn();
    const onObservation = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants, onObservation);

    detector.start();
    vi.advanceTimersByTime(200);
    expect(onObservation).not.toHaveBeenCalled();

    participant.setAttribute('aria-label', 'Alicia Sharma');
    await Promise.resolve();
    vi.advanceTimersByTime(1_200);

    expect(onObservation).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'display-name-changed',
        previousName: 'Alice Sharma',
        currentName: 'Alicia Sharma',
        observedAt: expect.any(Number),
      }),
    ]);
    detector.stop();
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

  it('ignores unrelated page subtree churn instead of refreshing the participant snapshot', async () => {
    const onParticipants = vi.fn();
    const detector = new ParticipantDetector(document, onParticipants);
    detector.start();
    vi.advanceTimersByTime(200);
    onParticipants.mockClear();

    const unrelated = document.createElement('div');
    unrelated.textContent = 'unrelated page update';
    document.body.appendChild(unrelated);
    await Promise.resolve();
    vi.advanceTimersByTime(200);

    expect(onParticipants).not.toHaveBeenCalled();
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

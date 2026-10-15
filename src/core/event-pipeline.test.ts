// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatMessageDetector } from '../adapters/meet/chat';
import { applyEvent, getEventScore } from './risk-engine';
import { EventPipeline } from './event-pipeline';
import type { NormalizedEvent, ParticipantState } from './types';

function event(
  type: NormalizedEvent['type'],
  participantName: string,
  timestamp: number,
): NormalizedEvent {
  return { type, participantName, timestamp, metadata: {} };
}

function createMessage(id: string, text: string): HTMLElement {
  const row = document.createElement('div');
  row.setAttribute('data-message-id', id);
  const content = document.createElement('div');
  content.setAttribute('jsname', 'dTKtvb');
  content.textContent = text;
  row.appendChild(content);
  return row;
}

function flushMutations(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1_050));
}

describe('EventPipeline', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('delivers normalized events as unattributed unless sender attribution is verified', () => {
    const onSnapshot = vi.fn();
    const pipeline = new EventPipeline(onSnapshot);
    const normalizedEvent = event('CHAT_MESSAGE', 'Phoenix', 100);

    pipeline.handleEvent(normalizedEvent);

    expect(onSnapshot).toHaveBeenCalledOnce();
    expect(onSnapshot.mock.calls[0][0].participantStates).toEqual([]);
    expect(onSnapshot.mock.calls[0][0].unattributedObservationCount).toBe(1);
  });

  it('keeps CHAT_MESSAGE at score zero', () => {
    const pipeline = new EventPipeline();
    const chatMessage = event('CHAT_MESSAGE', 'Phoenix', 100);

    pipeline.handleEvent(chatMessage);

    expect(getEventScore(chatMessage)).toBe(0);
    expect(pipeline.getSnapshot().participantStates).toEqual([]);
    expect(pipeline.getSnapshot().unattributedSignalTypes).toEqual([]);
  });

  it('does not let an unknown-sender event affect a verified participant score', () => {
    const pipeline = new EventPipeline();
    pipeline.handleAttributedEvent(event('SUSPICIOUS_LINK', 'Phoenix', 100), {
      participantKey: 'session-participant-1',
      participantName: 'Phoenix',
    });
    pipeline.handleEvent(event('SUSPICIOUS_LINK', 'Unknown participant', 200));

    const snapshot = pipeline.getSnapshot();
    expect(snapshot.participantStates).toHaveLength(1);
    expect(snapshot.participantStates[0]).toMatchObject({ participantName: 'Phoenix', score: 30 });
    expect(snapshot.unattributedObservationCount).toBe(1);
    expect(snapshot.unattributedSignalTypes).toEqual(['SUSPICIOUS_LINK']);
  });

  it('keeps a suspicious URL as an unattributed signal without creating a participant identity', () => {
    const pipeline = new EventPipeline();
    const unknownEvent = {
      ...event('SUSPICIOUS_LINK', 'Unknown participant', 100),
      metadata: { messageLength: 22, suspiciousLinkDetected: true },
    };

    pipeline.handleEvent(unknownEvent);

    const snapshot = pipeline.getSnapshot();
    expect(snapshot.participantStates).toEqual([]);
    expect(snapshot.unattributedObservationCount).toBe(1);
    expect(snapshot.unattributedSignalTypes).toEqual(['SUSPICIOUS_LINK']);
    expect(JSON.stringify(snapshot)).not.toContain('Unknown participant');
  });

  it('aggregates unattributed signals without retaining event payloads', () => {
    const pipeline = new EventPipeline();
    pipeline.handleEvent({
      ...event('CHAT_MESSAGE', 'Unknown participant', 100),
      metadata: { messageLength: 12, messageText: 'private text' },
    });
    pipeline.handleEvent(event('SUSPICIOUS_LINK', 'Unknown participant', 200));
    pipeline.handleEvent(event('SUSPICIOUS_LINK', 'Unknown participant', 300));

    const snapshot = pipeline.getSnapshot();
    expect(snapshot.unattributedObservationCount).toBe(3);
    expect(snapshot.unattributedSignalTypes).toEqual(['SUSPICIOUS_LINK']);
    expect(snapshot.unattributedSignalCount).toBe(2);
    expect(JSON.stringify(snapshot)).not.toContain('private text');
  });

  it('rejects unknown-participant labels even when passed through the attributed path', () => {
    const pipeline = new EventPipeline();
    pipeline.handleAttributedEvent(event('SUSPICIOUS_LINK', 'UNKNOWN PARTICIPANT', 100), {
      participantKey: 'not-a-real-participant',
      participantName: ' Unknown participant ',
    });

    const snapshot = pipeline.getSnapshot();
    expect(snapshot.participantStates).toEqual([]);
    expect(snapshot.unattributedObservationCount).toBe(1);
    expect(snapshot.unattributedSignalTypes).toEqual(['SUSPICIOUS_LINK']);
  });

  it('does not repeat an unattributed signal when Meet mutates the same message row', async () => {
    const pipeline = new EventPipeline();
    const onEvent = vi.fn((normalizedEvent: NormalizedEvent) => pipeline.handleEvent(normalizedEvent));
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    const message = createMessage('message-1', 'Open https://bit.ly/example');
    document.body.appendChild(message);
    await flushMutations();
    message.querySelector('[jsname="dTKtvb"]')!.textContent = 'Changed after render';
    message.appendChild(document.createElement('span'));
    await flushMutations();
    detector.stop();

    expect(onEvent.mock.calls.map(([normalizedEvent]) => normalizedEvent.type)).toEqual([
      'CHAT_MESSAGE',
      'SUSPICIOUS_LINK',
    ]);
    expect(pipeline.getSnapshot().unattributedObservationCount).toBe(2);
    expect(pipeline.getSnapshot().unattributedSignalTypes).toEqual(['SUSPICIOUS_LINK']);
    expect(pipeline.getSnapshot().participantStates).toEqual([]);
  });

  it('uses explicit verified attribution before applying participant cooldown and scoring', () => {
    const pipeline = new EventPipeline();
    const attribution = { participantKey: 'session-participant-1', participantName: 'Phoenix' };
    pipeline.handleAttributedEvent(event('CHAT_SPAM', 'Phoenix', 100), attribution);
    pipeline.handleAttributedEvent(event('CHAT_SPAM', 'Phoenix', 200), attribution);

    const snapshot = pipeline.getSnapshot();
    expect(snapshot.participantStates[0].score).toBe(25);
    expect(snapshot.participantStates[0].events).toHaveLength(1);

    const initialState: ParticipantState = {
      participantName: 'Phoenix',
      score: 0,
      reasons: [],
      events: [],
      lastUpdated: 0,
    };
    const scored = applyEvent(initialState, event('SUSPICIOUS_LINK', 'Phoenix', 100));
    expect(scored.score).toBe(30);
  });
});

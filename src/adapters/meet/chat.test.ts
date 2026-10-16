// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateRisk, getEventScore } from '../../core/risk-engine';
import type { SecurityAlert } from '../../core/types';
import { ChatMessageDetector, parseChatMessage } from './chat';
import { hasSuspiciousUrl } from './signals';

function createMessage(id: string, text: string, ariaLabel?: string): HTMLElement {
  const row = document.createElement('div');
  if (id) row.setAttribute('data-message-id', id);
  if (ariaLabel !== undefined) row.setAttribute('aria-label', ariaLabel);

  const content = document.createElement('div');
  content.setAttribute('jsname', 'dTKtvb');
  content.textContent = text;
  row.appendChild(content);
  return row;
}

function flushMutations(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1_050));
}

describe('ChatMessageDetector', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('detects a new message with a data-message-id', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    document.body.appendChild(createMessage('message-1', 'Hello Meet'));
    await flushMutations();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0]).toMatchObject({
      type: 'CHAT_MESSAGE',
      participantName: 'Unknown participant',
      metadata: { messageLength: 10 },
    });
    detector.stop();
  });

  it('counts multiple distinct messages once each', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    container.append(
      createMessage('message-1', 'First'),
      createMessage('message-2', 'Second'),
    );
    await flushMutations();

    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'CHAT_MESSAGE',
      'CHAT_MESSAGE',
    ]);
    detector.stop();
  });

  it('does not emit a duplicate when the same message is mutated again', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    const message = createMessage('message-1', 'Open https://bit.ly/example');
    document.body.appendChild(message);
    await flushMutations();

    message.querySelector('[jsname="dTKtvb"]')!.textContent = 'Edited';
    message.appendChild(document.createElement('span'));
    await flushMutations();

    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'CHAT_MESSAGE',
      'SUSPICIOUS_LINK',
    ]);
    detector.stop();
  });

  it('detects messages added inside an already-existing chat container', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    container.appendChild(createMessage('message-1', 'Inside existing container'));
    await flushMutations();

    expect(onEvent).toHaveBeenCalledTimes(1);
    detector.stop();
  });

  it('detects messages inside a newly inserted subtree', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    const subtree = document.createElement('section');
    subtree.append(
      createMessage('message-1', 'Nested first'),
      createMessage('message-2', 'Nested second'),
    );

    document.body.appendChild(subtree);
    await flushMutations();

    expect(onEvent).toHaveBeenCalledTimes(2);
    detector.stop();
  });

  it('handles a message row whose message id and text arrive after insertion', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    const row = document.createElement('div');
    const content = document.createElement('div');
    content.setAttribute('jsname', 'dTKtvb');
    row.appendChild(content);
    document.body.appendChild(row);
    await Promise.resolve();

    row.setAttribute('data-message-id', 'late-message-id');
    await Promise.resolve();
    content.textContent = 'Loaded after the row';
    await flushMutations();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0]).toMatchObject({
      type: 'CHAT_MESSAGE',
      sourceId: 'late-message-id',
      metadata: { messageLength: 'Loaded after the row'.length },
    });
    detector.stop();
  });

  it('counts only the surviving row when Meet replaces an optimistic message row', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    const optimisticRow = createMessage('temporary-message-id', 'hii');
    document.body.appendChild(optimisticRow);
    // Real Meet can replace its optimistic row after the previous 100 ms
    // settle window, so keep the temporary row connected briefly.
    await new Promise((resolve) => setTimeout(resolve, 250));

    optimisticRow.remove();
    document.body.appendChild(createMessage('server-message-id', 'hii'));
    await flushMutations();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0]).toMatchObject({
      type: 'CHAT_MESSAGE',
      metadata: { messageLength: 3 },
    });
    detector.stop();
  });

  it('ignores messages without data-message-id instead of inventing an identity', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    document.body.appendChild(createMessage('', 'No stable message id'));
    await flushMutations();

    expect(onEvent).not.toHaveBeenCalled();
    detector.stop();
  });

  it('emits a suspicious-link event for a suspicious URL', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    document.body.appendChild(createMessage('message-1', 'Open https://bit.ly/example'));
    await flushMutations();

    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'CHAT_MESSAGE',
      'SUSPICIOUS_LINK',
    ]);
    expect(onEvent.mock.calls[1][0].metadata).toEqual({
      messageLength: 'Open https://bit.ly/example'.length,
      suspiciousLinkDetected: true,
      signalCount: 1,
    });
    detector.stop();
  });

  it('does not flag ordinary text or a normal Meet URL as suspicious', () => {
    expect(hasSuspiciousUrl('Please visit https://meet.google.com/abc-defg-hij')).toBe(false);
    expect(hasSuspiciousUrl('The words bit.ly and example.com are just text')).toBe(false);
  });

  it('does not infer a sender from an unverified message-row aria-label', () => {
    const event = parseChatMessage(createMessage('message-1', 'Hello', 'Phoenix'));

    expect(event?.participantName).toBe('Unknown participant');
  });

  it('ignores existing message history when the detector starts', async () => {
    document.body.appendChild(createMessage('existing-message', 'Earlier message'));
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    await flushMutations();

    expect(onEvent).not.toHaveBeenCalled();
    document.body.appendChild(createMessage('new-message', 'New message'));
    await flushMutations();
    expect(onEvent).toHaveBeenCalledTimes(1);
    detector.stop();
  });

  it('disconnects on stop and emits no later events', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    detector.stop();

    document.body.appendChild(createMessage('message-1', 'After stop'));
    await flushMutations();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('makes start idempotent and deduplicates events', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    detector.start();

    document.body.appendChild(createMessage('message-1', 'Only once'));
    await flushMutations();

    expect(observe).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(1);
    detector.stop();
  });

  it('restarts cleanly and treats messages already on the page as history', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    detector.stop();
    document.body.appendChild(createMessage('history-after-restart', 'Do not replay'));
    detector.start();
    await flushMutations();

    expect(onEvent).not.toHaveBeenCalled();
    document.body.appendChild(createMessage('new-after-restart', 'Count this one'));
    await flushMutations();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].sourceId).toBe('new-after-restart');
    detector.stop();
  });

  it('does not persist message text or participant data to chrome.storage', async () => {
    const storageWrite = vi.fn();
    vi.stubGlobal('chrome', { storage: { local: { set: storageWrite } } });
    const detector = new ChatMessageDetector(document, vi.fn());
    detector.start();

    document.body.appendChild(createMessage('message-1', 'Private chat text'));
    await flushMutations();

    expect(storageWrite).not.toHaveBeenCalled();
    detector.stop();
  });

  it('keeps normalized chat events compatible with RiskEngine scoring', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();

    document.body.append(
      createMessage('normal-message', 'Hello'),
      createMessage('link-message', 'Open https://tinyurl.com/example'),
    );
    await flushMutations();

    const messageEvent = onEvent.mock.calls.find(([event]) => event.type === 'CHAT_MESSAGE')![0];
    const suspiciousLinkEvent = onEvent.mock.calls.find(([event]) => event.type === 'SUSPICIOUS_LINK')![0];
    expect(messageEvent).toMatchObject({ type: 'CHAT_MESSAGE', participantName: 'Unknown participant' });
    expect(messageEvent.metadata).toEqual({ messageLength: 5 });
    expect(getEventScore(messageEvent)).toBe(0);
    expect(calculateRisk([messageEvent])).toBe(0);
    expect(getEventScore(suspiciousLinkEvent)).toBe(30);
    expect(calculateRisk([suspiciousLinkEvent])).toBe(30);
    expect(JSON.stringify(messageEvent)).not.toContain('Hello');
    detector.stop();
  });

  it('attaches explainable message findings without retaining the message text', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    document.body.appendChild(createMessage(
      'message-alert',
      'Urgent: send your OTP immediately or your account will be locked https://bit.ly/demo',
    ));
    await flushMutations();

    const messageEvent = onEvent.mock.calls.find(([event]) => event.type === 'CHAT_MESSAGE')?.[0];
    expect(messageEvent?.sourceId).toBe('message-alert');
    expect(messageEvent?.securityAlerts?.map((alert: SecurityAlert) => alert.category)).toEqual([
      'LINK_SIGNAL',
      'PHISHING_INDICATOR',
    ]);
    expect(JSON.stringify(messageEvent)).not.toContain('send your OTP');
    detector.stop();
  });

  it('analyzes anchor hrefs even when the linked destination is not written as text', async () => {
    const onEvent = vi.fn();
    const detector = new ChatMessageDetector(document, onEvent);
    detector.start();
    const message = createMessage('linked-message', 'Open this link');
    const anchor = document.createElement('a');
    anchor.href = 'https://tinyurl.com/hidden-destination';
    anchor.textContent = 'this link';
    message.querySelector('[jsname="dTKtvb"]')?.appendChild(anchor);
    document.body.appendChild(message);
    await flushMutations();

    const messageEvent = onEvent.mock.calls.find(([event]) => event.type === 'CHAT_MESSAGE')?.[0];
    expect(messageEvent?.securityAlerts?.some((alert: SecurityAlert) => alert.ruleId === 'link.shortener-host')).toBe(true);
    expect(JSON.stringify(messageEvent)).not.toContain('hidden-destination');
    detector.stop();
  });
});

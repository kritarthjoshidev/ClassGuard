import type { NormalizedEvent } from '../../core/types';
import type { ChatAnalysisSettings } from '../../core/types';
import { ChatSecurityAnalyzer } from '../../core/chat-security';

export const CHAT_MESSAGE_SELECTOR = '[data-message-id]';
const CHAT_MESSAGE_TEXT_SELECTOR = '[jsname="dTKtvb"]';
// Meet can keep an optimistic row around while its server-backed message row
// is being created. Wait long enough for that replacement before counting it.
const CHAT_MESSAGE_SETTLE_DELAY_MS = 1_000;
const MAX_PENDING_MESSAGES = 200;
const MAX_MESSAGE_TEXT_LENGTH = 4_000;
const MAX_MESSAGE_ID_LENGTH = 200;

function getMessageText(element: Element): string {
  const content = element.querySelector(CHAT_MESSAGE_TEXT_SELECTOR) ?? element;
  return (content.textContent ?? '').slice(0, MAX_MESSAGE_TEXT_LENGTH).trim().replace(/\s+/g, ' ');
}

export function parseChatMessage(element: Element): NormalizedEvent | null {
  const message = getMessageText(element);
  if (!message) return null;

  return {
    type: 'CHAT_MESSAGE',
    // The observed message row does not expose a verified sender field.
    // Its aria-label may describe the row or controls, so do not infer identity.
    participantName: 'Unknown participant',
    timestamp: Date.now(),
    // Keep only message length; never retain the message text itself.
    metadata: { messageLength: message.length },
  };
}

export type ChatEventHandler = (event: NormalizedEvent) => void;

export class ChatMessageDetector {
  private readonly observer: MutationObserver;
  private readonly onEvent: ChatEventHandler;
  private readonly seenMessageIds = new Set<string>();
  private readonly pendingMessageElements = new Set<Element>();
  private readonly analyzer = new ChatSecurityAnalyzer();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(private readonly root: Document, onEvent: ChatEventHandler) {
    this.onEvent = onEvent;
    this.observer = new MutationObserver((records) => this.handleMutations(records));
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    // Mark already-rendered messages as history so startup does not replay them.
    for (const message of this.root.querySelectorAll(CHAT_MESSAGE_SELECTOR)) {
      const id = message.getAttribute('data-message-id')?.trim().slice(0, MAX_MESSAGE_ID_LENGTH);
      if (id) this.remember(id);
    }
    this.observer.observe(this.root.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-message-id', 'jsname'],
      characterData: true,
    });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.observer.disconnect();
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingMessageElements.clear();
    this.seenMessageIds.clear();
    this.analyzer.clear();
  }

  setAnalysisSettings(settings: ChatAnalysisSettings): void {
    this.analyzer.setSettings(settings);
  }

  private handleMutations(records: MutationRecord[]): void {
    if (!this.active) return;

    const messageElements = new Set<Element>();
    for (const record of records) {
      if (record.type !== 'childList') {
        const changedElement = record.target instanceof Element
          ? record.target
          : record.target.parentElement;
        if (!changedElement) continue;
        if (changedElement.matches(CHAT_MESSAGE_SELECTOR)) messageElements.add(changedElement);
        const owningMessage = changedElement.closest(CHAT_MESSAGE_SELECTOR);
        if (owningMessage) messageElements.add(owningMessage);
        continue;
      }

      const changedNodes = [...record.addedNodes];
      for (const node of changedNodes) {
        const element = node instanceof Element ? node : node.parentElement;
        if (!element) continue;

        if (element.matches(CHAT_MESSAGE_SELECTOR)) messageElements.add(element);
        const owningMessage = element.closest(CHAT_MESSAGE_SELECTOR);
        if (owningMessage) messageElements.add(owningMessage);
        for (const nestedMessage of element.querySelectorAll(CHAT_MESSAGE_SELECTOR)) {
          messageElements.add(nestedMessage);
        }
      }
    }

    for (const element of messageElements) {
      this.pendingMessageElements.add(element);
      while (this.pendingMessageElements.size > MAX_PENDING_MESSAGES) {
        const oldest = this.pendingMessageElements.values().next().value;
        if (!oldest) break;
        this.pendingMessageElements.delete(oldest);
      }
    }

    if (this.pendingMessageElements.size > 0 && this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushPendingMessages();
      }, CHAT_MESSAGE_SETTLE_DELAY_MS);
    }
  }

  private flushPendingMessages(): void {
    if (!this.active) return;

    const pendingElements = [...this.pendingMessageElements];
    this.pendingMessageElements.clear();

    for (const element of pendingElements) {
      // Meet can briefly insert an optimistic message row, then replace it
      // with the server-rendered row. Only process the row that survived.
      if (this.root.documentElement.contains(element)) this.processMessage(element);
    }
  }

  private processMessage(element: Element): void {
    const id = element.getAttribute('data-message-id')?.trim().slice(0, MAX_MESSAGE_ID_LENGTH);
    if (!id || this.seenMessageIds.has(id)) return;

    const event = parseChatMessage(element);
    if (!event) return;

    const messageText = getMessageText(element);
    const linkedHrefs = [...element.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .slice(0, 20)
      .map((link) => link.href);
    event.sourceId = id;
    event.securityAlerts = this.analyzer.analyze(id, messageText, linkedHrefs);

    this.remember(id);
    this.onEvent(event);

    const linkSignals = event.securityAlerts.filter((alert) => alert.category === 'LINK_SIGNAL');
    if (linkSignals.length > 0) {
      this.onEvent({
        ...event,
        type: 'SUSPICIOUS_LINK',
        securityAlerts: undefined,
        metadata: {
          messageLength: messageText.length,
          suspiciousLinkDetected: true,
          signalCount: linkSignals.length,
        },
      });
    }
  }

  private remember(id: string): void {
    this.seenMessageIds.add(id);
    if (this.seenMessageIds.size > 500) {
      const oldestId = this.seenMessageIds.values().next().value;
      if (oldestId) this.seenMessageIds.delete(oldestId);
    }
  }
}

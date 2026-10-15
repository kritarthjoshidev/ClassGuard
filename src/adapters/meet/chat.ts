import type { NormalizedEvent } from '../../core/types';
import { hasSuspiciousUrl } from './signals';

export const CHAT_MESSAGE_SELECTOR = '[data-message-id]';
const CHAT_MESSAGE_TEXT_SELECTOR = '[jsname="dTKtvb"]';

function getMessageText(element: Element): string {
  const content = element.querySelector(CHAT_MESSAGE_TEXT_SELECTOR) ?? element;
  return content.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}

export function parseChatMessage(element: Element): NormalizedEvent | null {
  const message = getMessageText(element);
  if (!message) return null;

  return {
    type: 'CHAT_MESSAGE',
    participantName: element.getAttribute('aria-label')?.trim() || 'Unknown participant',
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
  private active = false;

  constructor(private readonly root: Document, onEvent: ChatEventHandler) {
    this.onEvent = onEvent;
    this.observer = new MutationObserver(() => this.scan());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    // Mark already-rendered messages as history so startup does not replay them.
    for (const message of this.root.querySelectorAll(CHAT_MESSAGE_SELECTOR)) {
      const id = message.getAttribute('data-message-id')?.trim();
      if (id) this.remember(id);
    }
    this.observer.observe(this.root.documentElement, { childList: true, subtree: true });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.observer.disconnect();
    this.seenMessageIds.clear();
  }

  private scan(): void {
    if (!this.active) return;

    for (const element of this.root.querySelectorAll(CHAT_MESSAGE_SELECTOR)) {
      const id = element.getAttribute('data-message-id')?.trim();
      if (!id || this.seenMessageIds.has(id)) continue;

      const event = parseChatMessage(element);
      if (!event) continue;

      this.remember(id);
      this.onEvent(event);

      const messageText = getMessageText(element);
      if (hasSuspiciousUrl(messageText)) {
        this.onEvent({
          ...event,
          type: 'SUSPICIOUS_LINK',
          metadata: { messageLength: messageText.length, suspiciousLinkDetected: true },
        });
      }
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

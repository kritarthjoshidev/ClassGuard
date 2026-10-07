import type { NormalizedEvent } from '../../core/types';

export function parseChatMessage(element: Element): NormalizedEvent | null {
  const message = element.textContent?.trim();
  if (!message) return null;
  return {
    type: 'CHAT_MESSAGE',
    participantName: element.getAttribute('aria-label')?.trim() || 'Unknown participant',
    timestamp: Date.now(),
    metadata: { messageLength: message.length },
  };
}

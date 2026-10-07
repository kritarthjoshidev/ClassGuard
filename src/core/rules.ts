import type { NormalizedEvent, EventType } from './types';

export const RULES: Record<EventType, { score: number; cooldownMs: number; description: string }> = {
  CHAT_MESSAGE: { score: 0, cooldownMs: 0, description: 'Chat activity observed' },
  CHAT_SPAM: { score: 25, cooldownMs: 30_000, description: 'Chat flood detected' },
  REJOIN_ANOMALY: { score: 20, cooldownMs: 60_000, description: 'Repeated rejoin pattern detected' },
  MIC_UNMUTE_BURST: { score: 30, cooldownMs: 60_000, description: 'Repeated microphone state changes detected' },
  SUSPICIOUS_LINK: { score: 30, cooldownMs: 60_000, description: 'Suspicious external link detected' },
  HOST_WARNING_IGNORED: { score: 20, cooldownMs: 60_000, description: 'Host warning was not acknowledged' },
};

export function createEvent(type: EventType, participantName: string, metadata: Record<string, unknown>): NormalizedEvent {
  return {
    type,
    participantName,
    timestamp: Date.now(),
    metadata,
  };
}

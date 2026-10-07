export type EventType =
  | 'CHAT_MESSAGE'
  | 'CHAT_SPAM'
  | 'REJOIN_ANOMALY'
  | 'MIC_UNMUTE_BURST'
  | 'SUSPICIOUS_LINK'
  | 'HOST_WARNING_IGNORED';

export type RiskLevel = 'safe' | 'watch' | 'high';

export interface NormalizedEvent {
  type: EventType;
  participantName: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface ParticipantState {
  participantName: string;
  score: number;
  reasons: string[];
  events: NormalizedEvent[];
  lastUpdated: number;
}

export type EventType =
  | 'CHAT_MESSAGE'
  | 'CHAT_SPAM'
  | 'REJOIN_ANOMALY'
  | 'MIC_UNMUTE_BURST'
  | 'SUSPICIOUS_LINK'
  | 'HOST_WARNING_IGNORED';

export type RiskLevel = 'safe' | 'watch' | 'high';

export type SecurityAlertCategory =
  | 'LINK_SIGNAL'
  | 'PHISHING_INDICATOR'
  | 'CHAT_SPAM'
  | 'POSSIBLE_HARASSMENT'
  | 'PARTICIPANT_ACTIVITY';

export type SecuritySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
export type EvidenceStrength = 'weak' | 'moderate' | 'strong';

/** Session-only, explainable observation. It is not a verified identity or malware verdict. */
export interface SecurityAlert {
  id: string;
  sourceId: string;
  category: SecurityAlertCategory;
  ruleId: string;
  severity: SecuritySeverity;
  title: string;
  explanation: string;
  evidence: string[];
  detectedAt: number;
  evidenceStrength: EvidenceStrength;
  attribution: 'unattributed' | 'verified';
  participantName?: string;
  dismissedAt?: number;
}

export interface ChatAnalysisSettings {
  linkSignals: boolean;
  phishingIndicators: boolean;
  spamSignals: boolean;
  abusiveLanguage: boolean;
}

export const DEFAULT_CHAT_ANALYSIS_SETTINGS: ChatAnalysisSettings = {
  linkSignals: true,
  phishingIndicators: true,
  spamSignals: true,
  abusiveLanguage: true,
};

export interface NormalizedEvent {
  type: EventType;
  participantName: string;
  timestamp: number;
  metadata: Record<string, unknown>;
  /** Ephemeral Meet message key, used only for in-memory deduplication. */
  sourceId?: string;
  /** Explainable findings; never contains the complete chat message. */
  securityAlerts?: SecurityAlert[];
}

export interface ParticipantState {
  participantName: string;
  score: number;
  reasons: string[];
  events: NormalizedEvent[];
  lastUpdated: number;
}

export interface ChatActivitySummary {
  messagesObserved: number;
  suspiciousLinks: number;
}

export interface RiskPipelineSnapshot {
  participantStates: ParticipantState[];
  unattributedObservationCount: number;
  unattributedSignalTypes: EventType[];
  securityAlerts?: SecurityAlert[];
  /** Total signal count; optional for compatibility with older snapshot producers. */
  unattributedSignalCount?: number;
}

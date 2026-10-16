import type { Participant, ParticipantObservation } from './participant-detector';
import { ParticipantDetector } from './participant-detector';
import { ChatMessageDetector, type ChatEventHandler } from './chat';
import type { ChatAnalysisSettings } from '../../core/types';
import { DEFAULT_CHAT_ANALYSIS_SETTINGS } from '../../core/types';

export type ParticipantSnapshotHandler = (participants: Participant[]) => void;
export type ParticipantObservationHandler = (observations: ParticipantObservation[]) => void;

export class MeetAdapter {
  private detector: ParticipantDetector | null = null;
  private chatDetector: ChatMessageDetector | null = null;
  private chatAnalysisSettings: ChatAnalysisSettings = { ...DEFAULT_CHAT_ANALYSIS_SETTINGS };

  constructor(
    private readonly root: Document,
    private readonly onParticipantsChange: ParticipantSnapshotHandler = () => undefined,
    private readonly onChatEvent: ChatEventHandler = () => undefined,
    private readonly onParticipantObservation: ParticipantObservationHandler = () => undefined,
  ) {}

  detectMeeting(): boolean {
    try {
      return new URL(window.location.href).hostname.toLowerCase() === 'meet.google.com';
    } catch {
      return false;
    }
  }

  get isRunning(): boolean {
    return this.detector !== null && this.chatDetector !== null;
  }

  start(): void {
    if (this.isRunning) return;
    this.stop();
    const participantDetector = new ParticipantDetector(this.root, this.onParticipantsChange, this.onParticipantObservation);
    const chatDetector = new ChatMessageDetector(this.root, this.onChatEvent);
    this.detector = participantDetector;
    this.chatDetector = chatDetector;
    try {
      participantDetector.start();
      chatDetector.setAnalysisSettings(this.chatAnalysisSettings);
      chatDetector.start();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  setChatAnalysisSettings(settings: ChatAnalysisSettings): void {
    this.chatAnalysisSettings = { ...settings };
    this.chatDetector?.setAnalysisSettings(this.chatAnalysisSettings);
  }

  stop(): void {
    this.detector?.stop();
    this.detector = null;
    this.chatDetector?.stop();
    this.chatDetector = null;
  }
}

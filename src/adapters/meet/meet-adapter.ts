import type { Participant } from './participant-detector';
import { ParticipantDetector } from './participant-detector';
import { ChatMessageDetector, type ChatEventHandler } from './chat';

export type ParticipantSnapshotHandler = (participants: Participant[]) => void;

export class MeetAdapter {
  private detector: ParticipantDetector | null = null;
  private chatDetector: ChatMessageDetector | null = null;

  constructor(
    private readonly root: Document,
    private readonly onParticipantsChange: ParticipantSnapshotHandler = () => undefined,
    private readonly onChatEvent: ChatEventHandler = () => undefined,
  ) {}

  detectMeeting(): boolean {
    return new URL(window.location.href).hostname.includes('meet.google.com');
  }

  start(): void {
    if (this.detector || this.chatDetector) return;
    this.detector = new ParticipantDetector(this.root, this.onParticipantsChange);
    this.detector.start();
    this.chatDetector = new ChatMessageDetector(this.root, this.onChatEvent);
    this.chatDetector.start();
  }

  stop(): void {
    this.detector?.stop();
    this.detector = null;
    this.chatDetector?.stop();
    this.chatDetector = null;
  }
}

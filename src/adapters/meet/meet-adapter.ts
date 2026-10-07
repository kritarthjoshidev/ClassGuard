import type { Participant } from './participant-detector';
import { ParticipantDetector } from './participant-detector';

export type ParticipantSnapshotHandler = (participants: Participant[]) => void;

export class MeetAdapter {
  private detector: ParticipantDetector | null = null;

  constructor(
    private readonly root: Document,
    private readonly onParticipantsChange: ParticipantSnapshotHandler = () => undefined,
  ) {}

  detectMeeting(): boolean {
    return new URL(window.location.href).hostname.includes('meet.google.com');
  }

  start(): void {
    if (this.detector) return;
    this.detector = new ParticipantDetector(this.root, this.onParticipantsChange);
    this.detector.start();
  }

  stop(): void {
    this.detector?.stop();
    this.detector = null;
  }
}

import type { ParticipantState } from '../../core/types';
import { ParticipantDetector, type DetectedParticipant } from './participant-detector';

export type ParticipantStateHandler = (participants: ParticipantState[]) => void;

export class MeetAdapter {
  private detector: ParticipantDetector | null = null;

  constructor(
    private readonly root: Document,
    private readonly onParticipantsChange: ParticipantStateHandler = () => undefined,
  ) {}

  detectMeeting(): boolean {
    return new URL(window.location.href).hostname.includes('meet.google.com');
  }

  start(): void {
    if (this.detector) return;

    this.detector = new ParticipantDetector(
      this.root,
      (participants: DetectedParticipant[]) => {
        const now = Date.now();
        this.onParticipantsChange(participants.map((participant) => ({
          participantName: participant.name,
          score: 0,
          reasons: [],
          events: [],
          lastUpdated: now,
        })));
      },
    );
    this.detector.start();
  }

  stop(): void {
    this.detector?.stop();
    this.detector = null;
  }
}

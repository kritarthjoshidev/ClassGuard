export class MeetAdapter {
  constructor(private readonly root: Document) {}

  detectMeeting(): boolean {
    return new URL(window.location.href).hostname.includes('meet.google.com');
  }

  start(): void {
    // Real detectors will register their own observable signals.
  }

  stop(): void {
    // No observer resources are owned until a real detector is added.
  }
}

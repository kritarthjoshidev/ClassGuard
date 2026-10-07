import { MeetAdapter } from '../adapters/meet/meet-adapter';

const adapter = new MeetAdapter(document);

function emit(message: string): void {
  console.info(`[ClassGuard] ${message}`);
}

function initialize(): void {
  const meetingUrl = window.location.href;
  if (!meetingUrl.includes('meet.google.com')) return;
  const observed = adapter.detectMeeting();
  if (observed) {
    emit('Meeting detected — Protection Active');
    adapter.start();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

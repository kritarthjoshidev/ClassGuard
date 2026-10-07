import { MeetAdapter } from '../adapters/meet/meet-adapter';
import { isActiveGoogleMeetUrl } from './meeting-detection';

const adapter = new MeetAdapter(document);

function emit(message: string): void {
  console.info(`[ClassGuard] ${message}`);
}

function initialize(): void {
  if (!isActiveGoogleMeetUrl(window.location.href)) return;

  const observed = adapter.detectMeeting();
  if (observed) {
    emit('Meeting detected');
    emit('Protection active');
    adapter.start();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

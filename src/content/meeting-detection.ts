const GOOGLE_MEET_HOST = 'meet.google.com';
const MEETING_PATH_PATTERN = /^\/[a-z0-9]+(?:-[a-z0-9]+)+(?:\/|$)/i;
const NON_MEETING_PATHS = new Set(['/', '/dashboard', '/home']);

export function isActiveGoogleMeetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== GOOGLE_MEET_HOST) return false;
    if (NON_MEETING_PATHS.has(parsed.pathname.toLowerCase())) return false;
    return MEETING_PATH_PATTERN.test(parsed.pathname);
  } catch {
    return false;
  }
}

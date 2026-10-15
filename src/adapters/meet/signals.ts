const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[),.;!?]+$/;

// These hosts are link-shortener signals only. They are not a malware verdict.
const HEURISTIC_SHORT_LINK_HOSTS = new Set(['bit.ly', 'tinyurl.com']);

export function hasSuspiciousUrl(text: string): boolean {
  const candidates = text.match(URL_PATTERN) ?? [];

  for (const candidate of candidates) {
    const cleanedCandidate = candidate.replace(TRAILING_PUNCTUATION, '');
    try {
      const url = new URL(cleanedCandidate);
      if (HEURISTIC_SHORT_LINK_HOSTS.has(url.hostname.toLowerCase())) return true;
    } catch {
      // Ignore malformed URL-like text; it is not enough to raise a signal.
    }
  }

  return false;
}

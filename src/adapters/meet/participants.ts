export function extractParticipantName(element: Element): string {
  const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
  return label.trim().replace(/\s+/g, ' ') || 'Unknown participant';
}

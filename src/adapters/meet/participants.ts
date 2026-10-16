const UI_TEXT_PATTERN = /frame_person|more options|more_vert|backgrounds and effects|visual_effects|you're continuously|microphone|camera|settings|chat|unmute/i;
const VISUAL_CONFUSABLES = new Map(Object.entries({
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j',
  'Α': 'a', 'α': 'a', 'Β': 'b', 'β': 'b', 'Ε': 'e', 'Ζ': 'z', 'ζ': 'z', 'Η': 'h', 'η': 'h',
  'Ι': 'i', 'Κ': 'k', 'κ': 'k', 'Μ': 'm', 'μ': 'm', 'Ν': 'n', 'ν': 'n', 'Ο': 'o', 'ο': 'o',
  'Ρ': 'p', 'ρ': 'p', 'Τ': 't', 'τ': 't', 'Υ': 'y', 'υ': 'y', 'Χ': 'x', 'χ': 'x',
}));

export interface DisplayNamePair {
  left: { domKey: string; participantName: string };
  right: { domKey: string; participantName: string };
  kind: 'duplicate' | 'visually-similar';
}

function displayNameSkeleton(value: string): string {
  return [...value.normalize('NFKC').toLocaleLowerCase()]
    .map((character) => VISUAL_CONFUSABLES.get(character) ?? character)
    .join('')
    .replace(/[\s._-]+/g, '');
}

/** Conservative lookalike check for a small set of common Latin/Cyrillic/Greek glyphs. */
export function findDisplayNamePairs(
  participants: Array<{ domKey: string; participantName: string }>,
): DisplayNamePair[] {
  const pairs: DisplayNamePair[] = [];
  for (let leftIndex = 0; leftIndex < participants.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < participants.length; rightIndex += 1) {
      const left = participants[leftIndex];
      const right = participants[rightIndex];
      const leftName = left.participantName.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
      const rightName = right.participantName.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
      if (left.domKey === right.domKey) continue;
      if (leftName === rightName) {
        pairs.push({ left, right, kind: 'duplicate' });
        continue;
      }
      const leftSkeleton = displayNameSkeleton(left.participantName);
      const rightSkeleton = displayNameSkeleton(right.participantName);
      if (leftSkeleton.length >= 3 && leftSkeleton === rightSkeleton) {
        pairs.push({ left, right, kind: 'visually-similar' });
      }
    }
  }
  return pairs;
}

function isUiControlText(value: string): boolean {
  return UI_TEXT_PATTERN.test(value);
}

function cleanName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && !isUiControlText(normalized) ? normalized : '';
}

function extractFromNameElement(element: HTMLElement): string {
  const nameSelectors = [
    '[data-participant-name]',
    '[data-participant-display-name]',
    '[data-participant-name-element]',
    '[data-name]',
    '[data-testid*="participant-name"]',
    '[data-testid*="person-name"]',
  ];

  for (const selector of nameSelectors) {
    const candidate = element.querySelector<HTMLElement>(selector);
    const name = candidate ? cleanName(candidate.textContent ?? candidate.getAttribute('aria-label') ?? '') : '';
    if (name) return name;
  }

  const descendantCandidates = Array.from(element.querySelectorAll<HTMLElement>('*'))
    .map((candidate) => ({
      candidate,
      name: cleanName(candidate.textContent ?? ''),
    }))
    .filter(({ candidate, name }) => {
      const directText = cleanName(candidate.textContent ?? '');
      const hasControlText = /(?:frame_person|reframe|more_vert|visual_effects|backgrounds and effects|more options|devices|microphone|camera|settings|chat|unmute|others might still see|leave call)/i.test(directText);
      const hasChildName = candidate.querySelector('*') !== null;
      const isSingleName = directText.split(/\s+/).length <= 3 && directText.length > 0;
      return isSingleName && !hasControlText && !hasChildName;
    });

  const firstCandidate = descendantCandidates[0];
  return firstCandidate?.name ?? '';
}

export function extractParticipantName(element: Element): string {
  if (!(element instanceof HTMLElement)) return '';

  // Meet exposes the participant's display name on the list item itself.
  // Read it before descendant labels, which belong to controls such as
  // "More actions" and "You can't unmute someone else".
  const directLabel = cleanName(element.getAttribute('aria-label') ?? '');
  if (directLabel) return directLabel;

  const nestedName = extractFromNameElement(element);
  if (nestedName) return nestedName;

  return '';
}

export function hasSuspiciousUrl(text: string): boolean {
  return /https?:\/\//i.test(text) && /(?:bit\.ly|tinyurl\.com|drive\.google\.com\/file\/d\/|example\.com)/i.test(text);
}

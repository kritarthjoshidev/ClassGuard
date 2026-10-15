import { describe, expect, it } from 'vitest';
import { hasSuspiciousUrl } from './signals';

describe('hasSuspiciousUrl', () => {
  it('flags explicitly configured short-link hosts as heuristic signals', () => {
    expect(hasSuspiciousUrl('Please check https://bit.ly/abc123')).toBe(true);
    expect(hasSuspiciousUrl('Open https://tinyurl.com/abc123.')).toBe(true);
  });

  it('does not flag generic example or Google Drive URLs', () => {
    expect(hasSuspiciousUrl('See https://example.com/path')).toBe(false);
    expect(hasSuspiciousUrl('Download https://drive.google.com/file/d/123/view')).toBe(false);
  });

  it('matches the parsed hostname exactly instead of matching URL substrings', () => {
    expect(hasSuspiciousUrl('https://bit.ly.attacker.example/path')).toBe(false);
    expect(hasSuspiciousUrl('https://attacker.example/?redirect=bit.ly')).toBe(false);
    expect(hasSuspiciousUrl('https://notbit.ly/path')).toBe(false);
  });

  it('ignores malformed and non-HTTP URL-like text', () => {
    expect(hasSuspiciousUrl('https://[invalid/bit.ly/path')).toBe(false);
    expect(hasSuspiciousUrl('ftp://bit.ly/file')).toBe(false);
  });
});

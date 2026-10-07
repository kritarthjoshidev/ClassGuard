import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isActiveGoogleMeetUrl } from './meeting-detection';

describe('extension foundation', () => {
  it('recognizes an active Google Meet meeting URL without accepting unrelated pages', () => {
    expect(isActiveGoogleMeetUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isActiveGoogleMeetUrl('https://meet.google.com/')).toBe(false);
    expect(isActiveGoogleMeetUrl('https://meet.google.com/dashboard')).toBe(false);
    expect(isActiveGoogleMeetUrl('https://example.com/abc-defg-hij')).toBe(false);
  });

  it('keeps the shipped manifest minimal and Manifest V3 compliant', () => {
    const manifestPath = resolve(process.cwd(), 'public/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      manifest_version: number;
      permissions: string[];
      host_permissions: string[];
      content_scripts: Array<{ matches: string[]; js: string[] }>;
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual(['https://meet.google.com/*']);
    expect(manifest.content_scripts[0].matches).toEqual(['https://meet.google.com/*']);
    expect(manifest.content_scripts[0].js).toEqual(['content.js']);
  });
});

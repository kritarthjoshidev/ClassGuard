import { describe, expect, it, vi } from 'vitest';
import { MeetAdapter } from './meet-adapter';

describe('MeetAdapter', () => {
  it('does not fabricate a chat event or persist it for a chat button', () => {
    const set = vi.fn();
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { storage: { local: { set } } },
    });
    const root = {
      documentElement: {},
      querySelector: vi.fn(() => ({ ariaLabel: 'Chat' })),
    } as unknown as Document;
    const adapter = new MeetAdapter(root);

    (adapter as unknown as { scan: () => void }).scan();

    expect(set).not.toHaveBeenCalled();
  });
});

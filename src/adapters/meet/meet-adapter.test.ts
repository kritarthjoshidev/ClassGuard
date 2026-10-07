import { describe, expect, it, vi } from 'vitest';
import { MeetAdapter } from './meet-adapter';

describe('MeetAdapter', () => {
  it('does not initialize a broad observer until a real detector exists', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    class FakeMutationObserver {
      observe = observe;
      disconnect = disconnect;
    }
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
    const adapter = new MeetAdapter({ documentElement: {} } as Document);

    adapter.start();
    adapter.start();
    adapter.stop();
    adapter.stop();

    expect(observe).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });
});

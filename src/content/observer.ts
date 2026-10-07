export class EventObserver {
  private readonly observer: MutationObserver;

  constructor(private readonly onMutate: () => void) {
    this.observer = new MutationObserver(onMutate);
  }

  observe(root: Node): void {
    this.observer.observe(root, { childList: true, subtree: true, attributes: true });
  }

  disconnect(): void {
    this.observer.disconnect();
  }
}

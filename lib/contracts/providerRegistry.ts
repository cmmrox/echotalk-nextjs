export class ProviderRegistry<T> {
  private current: T;

  constructor(initial: T) {
    this.current = initial;
  }

  get() {
    return this.current;
  }

  replace(next: T) {
    const previous = this.current;
    this.current = next;
    return previous;
  }
}

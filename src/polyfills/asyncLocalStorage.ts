/**
 * Minimal AsyncLocalStorage polyfill for browser/Tauri environments.
 * LangGraph expects Node's AsyncLocalStorage; this lightweight version
 * serializes access on the main thread which is sufficient for the app's usage.
 */

export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.store;
    this.store = store;
    try {
      return callback(...args);
    } finally {
      this.store = previous;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }

  enterWith(store: T): void {
    this.store = store;
  }

  disable(): void {
    this.store = undefined;
  }
}

export default { AsyncLocalStorage };

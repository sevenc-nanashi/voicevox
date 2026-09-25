/**
 * using文（Explicit Resource Management）で使えるsetTimeoutのラッパー。
 * usingのスコープを抜けると自動的にclearTimeoutされる。
 */
export class ErmTimeout {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cleared = false;

  constructor(ms: number, callback: () => void) {
    this.timer = setTimeout(callback, ms);
  }

  clear() {
    this.cleared = true;
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  [Symbol.dispose]() {
    if (!this.cleared && this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

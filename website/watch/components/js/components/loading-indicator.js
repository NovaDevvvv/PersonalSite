export class LoadingIndicator {
  constructor(element, frames, intervalMs = 350) {
    this.element = element;
    this.frames = frames;
    this.intervalMs = intervalMs;
    this.frameIndex = 0;
    this.intervalId = null;
    this.lockedText = null;
  }

  start() {
    if (this.lockedText || this.intervalId !== null) {
      return;
    }

    this.intervalId = window.setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.element.textContent = this.frames[this.frameIndex];
    }, this.intervalMs);
  }

  pause() {
    if (this.intervalId === null) {
      return;
    }

    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  resume() {
    this.start();
  }

  setText(text) {
    this.lockedText = text;
    this.pause();
    this.element.textContent = text;
  }
}
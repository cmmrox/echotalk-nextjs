export type VadLoopCallbacks = {
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  /** Called every animation frame with the current mic peak level (0–127). */
  onVolumeChange?: (level: number) => void;
};

export type VadLoopOptions = {
  threshold?: number;
  silenceMs?: number;
  minSpeechMs?: number;
};

export class VadLoop {
  private analyser: AnalyserNode;
  private data: Uint8Array;
  private rafId: number | null = null;
  private speaking = false;
  private speechStartAt = 0;
  private lastAboveThresholdAt = 0;
  private threshold: number;
  private silenceMs: number;
  private minSpeechMs: number;
  private callbacks: VadLoopCallbacks;

  constructor(
    audioContext: AudioContext,
    stream: MediaStream,
    callbacks: VadLoopCallbacks,
    options?: VadLoopOptions
  ) {
    const source = audioContext.createMediaStreamSource(stream);
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.fftSize);
    this.callbacks = callbacks;
    this.threshold = options?.threshold ?? 18;
    this.silenceMs = options?.silenceMs ?? 1200;
    this.minSpeechMs = options?.minSpeechMs ?? 400;
  }

  start() {
    const tick = () => {
      this.analyser.getByteTimeDomainData(this.data);
      let peak = 0;
      for (let i = 0; i < this.data.length; i += 1) {
        const value = Math.abs(this.data[i] - 128);
        if (value > peak) peak = value;
      }

      // Emit volume level every frame for the mic meter UI.
      this.callbacks.onVolumeChange?.(peak);

      const now = performance.now();

      if (peak >= this.threshold) {
        this.lastAboveThresholdAt = now;
        if (!this.speaking) {
          this.speaking = true;
          this.speechStartAt = now;
          this.callbacks.onSpeechStart();
        }
      } else if (
        this.speaking &&
        now - this.lastAboveThresholdAt >= this.silenceMs &&
        now - this.speechStartAt >= this.minSpeechMs
      ) {
        this.speaking = false;
        this.callbacks.onSpeechEnd();
      }

      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  stop() {
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Emit zero so the meter resets when stopped.
    this.callbacks.onVolumeChange?.(0);
  }
}

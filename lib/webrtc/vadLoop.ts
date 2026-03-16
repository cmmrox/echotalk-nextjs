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
  /** When true, VAD doesn't fire speech events (used during AI playback). */
  private _muted = false;

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

  get muted() {
    return this._muted;
  }

  /**
   * Mute the VAD: volume meter emits 0 and speech events are suppressed.
   * Call before AI audio playback starts to prevent the mic picking up speaker
   * audio and triggering a new STT turn.
   */
  mute() {
    this._muted = true;
    // If we were mid-speech, reset so we don't fire a stale onSpeechEnd later.
    this.speaking = false;
    this.lastAboveThresholdAt = 0;
    this.callbacks.onVolumeChange?.(0);
  }

  /**
   * Unmute the VAD: normal speech detection resumes.
   * Call after AI audio playback ends.
   */
  unmute() {
    this._muted = false;
    // Reset internal timers so a fresh listen cycle begins immediately.
    this.speaking = false;
    this.lastAboveThresholdAt = 0;
  }

  start() {
    const tick = () => {
      this.analyser.getByteTimeDomainData(this.data);
      let peak = 0;
      for (let i = 0; i < this.data.length; i += 1) {
        const value = Math.abs(this.data[i] - 128);
        if (value > peak) peak = value;
      }

      if (this._muted) {
        // Emit 0 to keep the mic bar showing "muted" state.
        this.callbacks.onVolumeChange?.(0);
        this.rafId = window.requestAnimationFrame(tick);
        return;
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
    this._muted = false;
    // Emit zero so the meter resets when stopped.
    this.callbacks.onVolumeChange?.(0);
  }
}

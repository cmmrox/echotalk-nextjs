export type RecordedTurn = {
  blob: Blob;
  mimeType: string;
};

function pickBestMimeType(): string | undefined {
  const preferred = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  if (typeof window === "undefined") return undefined;
  if (typeof MediaRecorder === "undefined") return undefined;

  for (const type of preferred) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }

  return undefined;
}

export class TurnRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream;
  private mimeType: string;

  constructor(stream: MediaStream) {
    this.stream = stream;
    this.mimeType = pickBestMimeType() || "audio/webm";
  }

  start() {
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
    this.recorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });
    this.recorder.start();
  }

  stop(): Promise<RecordedTurn> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) {
        reject(new Error("Recorder not started"));
        return;
      }

      const active = this.recorder;
      active.addEventListener(
        "stop",
        () => {
          const blob = new Blob(this.chunks, {
            type: active.mimeType || this.mimeType,
          });
          resolve({
            blob,
            mimeType: blob.type || this.mimeType,
          });
        },
        { once: true }
      );

      active.stop();
      this.recorder = null;
    });
  }
}

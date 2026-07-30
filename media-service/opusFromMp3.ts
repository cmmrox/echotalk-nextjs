/**
 * Convert a TTS MP3 buffer to an array of raw Opus frame payloads.
 *
 * Pipeline:
 *   MP3 buffer → ffmpeg (stdin→stdout) → OGG Opus → parse pages → Opus frames
 *
 * The resulting frames are suitable for direct injection into WebRTC RTP
 * packets (one frame per packet, 20 ms per frame, 48 kHz mono).
 */

import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const FFMPEG =
  process.env.FFMPEG_PATH ||
  ffmpegInstaller.path;

// ---------------------------------------------------------------------------
// OGG page parser — extracts raw Opus frame payloads from an OGG Opus buffer.
// Skips the first two header pages (OpusHead + OpusTags).
// ---------------------------------------------------------------------------

function parseOggOpusFrames(ogg: Buffer): Buffer[] {
  const frames: Buffer[] = [];
  let offset = 0;
  let pageIndex = 0;

  while (offset + 27 <= ogg.length) {
    // Verify OggS capture pattern
    if (
      ogg[offset] !== 0x4f || // O
      ogg[offset + 1] !== 0x67 || // g
      ogg[offset + 2] !== 0x67 || // g
      ogg[offset + 3] !== 0x53    // S
    ) {
      break;
    }

    const numSegments = ogg[offset + 26];
    if (offset + 27 + numSegments > ogg.length) break;

    const segTable = ogg.slice(offset + 27, offset + 27 + numSegments);
    const dataOffset = offset + 27 + numSegments;
    let dataSize = 0;
    for (let i = 0; i < numSegments; i++) dataSize += segTable[i];

    // Audio pages start at index 2 (0=OpusHead BOS, 1=OpusTags)
    if (pageIndex >= 2) {
      let pos = dataOffset;
      const packetBytes: number[] = [];

      for (let i = 0; i < numSegments; i++) {
        const segSize = segTable[i];
        for (let j = 0; j < segSize; j++) {
          packetBytes.push(ogg[pos + j]);
        }
        pos += segSize;

        if (segSize < 255) {
          // End of this packet
          if (packetBytes.length > 0) {
            frames.push(Buffer.from(packetBytes));
            packetBytes.length = 0;
          }
        }
      }

      // Partial last packet (continuation on next page) — flush anyway
      if (packetBytes.length > 0) {
        frames.push(Buffer.from(packetBytes));
      }
    }

    offset += 27 + numSegments + dataSize;
    pageIndex++;
  }

  return frames;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an MP3 (or any audio buffer ffmpeg can decode) to an array of raw
 * Opus frame payloads ready for WebRTC RTP injection.
 *
 * @param audioBuffer  Source audio (MP3 expected from Google TTS)
 * @returns Array of Buffers — each is one 20 ms Opus frame at 48 kHz mono
 */
export async function audioBufferToOpusFrames(
  audioBuffer: Buffer
): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    // ffmpeg: stdin → 48 kHz mono 32 kbps Opus OGG Opus → stdout
    const proc = spawn(FFMPEG, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",        // read from stdin
      "-ar", "48000",         // 48 kHz (standard WebRTC rate)
      "-ac", "1",             // mono
      "-c:a", "libopus",      // Opus encoder
      "-b:a", "32k",          // constant 32 kbps
      "-vbr", "off",          // CBR for predictable frame sizes
      "-frame_duration", "20",// 20 ms frames = 960 samples
      "-application", "voip", // VoIP tuning (matches WebRTC use case)
      "-f", "ogg",            // OGG container
      "pipe:1",               // write to stdout
    ]);

    const chunks: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));

    const stderrLines: string[] = [];
    proc.stderr.on("data", (d: Buffer) => stderrLines.push(d.toString()));

    proc.on("error", (err) => reject(new Error(`ffmpeg spawn error: ${err.message}`)));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg exited ${code}: ${stderrLines.slice(-5).join(" ").trim()}`
          )
        );
        return;
      }

      const oggBuffer = Buffer.concat(chunks);
      if (oggBuffer.length < 64) {
        reject(new Error("ffmpeg produced empty output"));
        return;
      }

      const frames = parseOggOpusFrames(oggBuffer);
      console.log("[opusFromMp3] conversion done", {
        inputBytes: audioBuffer.length,
        oggBytes: oggBuffer.length,
        opusFrames: frames.length,
        durationSeconds: (frames.length * 0.02).toFixed(2),
      });
      resolve(frames);
    });

    proc.stdin.on("error", () => {}); // stdin may close early — ignore
    proc.stdin.write(audioBuffer);
    proc.stdin.end();
  });
}

/**
 * OGG Opus container builder for raw WebRTC Opus frames.
 *
 * WebRTC delivers audio as raw Opus-encoded RTP payloads (one frame per packet,
 * typically 20ms at 48 kHz). Google STT V2 accepts OGG/Opus with autoDecodingConfig.
 * This module wraps the raw frames in a minimal valid OGG Opus container so STT
 * can decode the audio correctly.
 *
 * OGG spec: https://www.xiph.org/ogg/doc/framing.html
 * Opus-in-OGG: https://wiki.xiph.org/OggOpus
 */

// ---------------------------------------------------------------------------
// OGG CRC-32 (polynomial 0x04c11db7, NOT the reflected CRC32 variant)
// ---------------------------------------------------------------------------

const OGG_CRC_TABLE: number[] = Array.from({ length: 256 }, (_, i) => {
  let r = i << 24;
  for (let j = 0; j < 8; j++) {
    r = r & 0x80000000 ? ((r << 1) ^ 0x04c11db7) : (r << 1);
  }
  return r >>> 0;
});

function oggCrc32(buf: Buffer): number {
  let crc = 0;
  for (const byte of buf) {
    crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]) >>> 0;
  }
  return crc;
}

// ---------------------------------------------------------------------------
// OGG page builder
// ---------------------------------------------------------------------------

const HEADER_BOS = 0x02; // beginning of stream
const HEADER_EOS = 0x04; // end of stream

/**
 * Build one OGG page containing the given packets.
 * Each element of `packets` is a complete OGG "packet" (Opus frame).
 */
function buildOggPage(
  packets: Buffer[],
  granulePosition: bigint,
  serialNumber: number,
  sequenceNumber: number,
  headerType: number
): Buffer {
  // Build the segment table. OGG packets are split into segments of max 255
  // bytes. A packet is terminated when its last segment is < 255 bytes
  // (including 0 for zero-length termination).
  const segmentSizes: number[] = [];
  for (const packet of packets) {
    let remaining = packet.length;
    while (remaining >= 255) {
      segmentSizes.push(255);
      remaining -= 255;
    }
    segmentSizes.push(remaining); // terminating segment (0..254)
  }

  const segmentTable = Buffer.from(segmentSizes);
  const data = Buffer.concat(packets);

  const pageSize = 27 + segmentTable.length + data.length;
  const page = Buffer.alloc(pageSize);

  page.write("OggS", 0, "ascii"); // capture pattern
  page[4] = 0; // stream structure version
  page[5] = headerType;
  page.writeBigInt64LE(granulePosition, 6);
  page.writeUInt32LE(serialNumber >>> 0, 14);
  page.writeUInt32LE(sequenceNumber >>> 0, 18);
  page.writeUInt32LE(0, 22); // checksum placeholder (filled below)
  page[26] = segmentSizes.length;
  segmentTable.copy(page, 27);
  data.copy(page, 27 + segmentTable.length);

  page.writeUInt32LE(oggCrc32(page), 22);
  return page;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a valid OGG Opus file from raw Opus frames.
 *
 * @param frames  Array of raw Opus payload Buffers (one per RTP packet).
 * @param sampleRate  Nominal input sample rate (almost always 48000 for WebRTC).
 * @param channels    Number of channels (1 = mono, 2 = stereo).
 */
export function buildOggOpus(
  frames: Buffer[],
  sampleRate = 48000,
  channels = 1
): Buffer {
  const serialNumber = Math.floor(Math.random() * 0xffffffff);
  const pages: Buffer[] = [];
  let sequenceNumber = 0;

  // --- OpusHead (ID header, first page, BOS) ---
  // RFC 7845 §5.2: granule position of the ID header page MUST be 0.
  const opusHead = Buffer.alloc(19);
  opusHead.write("OpusHead", 0, "ascii");
  opusHead[8] = 1; // version
  opusHead[9] = channels;
  opusHead.writeUInt16LE(312, 10); // pre-skip (standard Opus value)
  opusHead.writeUInt32LE(sampleRate, 12); // original input sample rate
  opusHead.writeInt16LE(0, 16); // output gain
  opusHead[18] = 0; // channel mapping family (simple stereo/mono)

  pages.push(
    buildOggPage([opusHead], 0n, serialNumber, sequenceNumber++, HEADER_BOS)
  );

  // --- OpusTags (comment header, second page) ---
  // RFC 7845: comment header page granule position is also 0.
  const vendor = "EchoTalk";
  const opusTags = Buffer.alloc(8 + 4 + vendor.length + 4);
  opusTags.write("OpusTags", 0, "ascii");
  opusTags.writeUInt32LE(vendor.length, 8);
  opusTags.write(vendor, 12, "ascii");
  opusTags.writeUInt32LE(0, 12 + vendor.length); // zero user comments

  pages.push(
    buildOggPage([opusTags], 0n, serialNumber, sequenceNumber++, 0x00)
  );

  if (frames.length === 0) {
    // Return a silent OGG with just headers; STT will return an empty transcript.
    return Buffer.concat(pages);
  }

  // --- Audio pages (50 frames per page ≈ 1 second at 20 ms/frame) ---
  // Granule position = accumulated PCM samples output (at 48 kHz).
  // Standard WebRTC Opus frame = 20 ms = 960 samples at 48 kHz.
  // We start from pre-skip so the decoder knows where audio begins.
  const FRAMES_PER_PAGE = 50;
  const SAMPLES_PER_FRAME = 960; // 20 ms @ 48 kHz
  let granulePos = BigInt(312); // start after pre-skip

  for (let i = 0; i < frames.length; i += FRAMES_PER_PAGE) {
    const chunk = frames.slice(i, i + FRAMES_PER_PAGE);
    granulePos += BigInt(chunk.length * SAMPLES_PER_FRAME);
    const isLast = i + FRAMES_PER_PAGE >= frames.length;

    pages.push(
      buildOggPage(
        chunk,
        granulePos,
        serialNumber,
        sequenceNumber++,
        isLast ? HEADER_EOS : 0x00
      )
    );
  }

  return Buffer.concat(pages);
}

/**
 * Build STT-ready audio from stored Opus frames.
 * Returns a proper OGG Opus buffer and the correct MIME type for Google STT.
 */
export function packageFramesForStt(frames: Buffer[]): {
  buffer: Buffer;
  mimeType: string;
  mode: string;
  frameCount: number;
} {
  if (frames.length === 0) {
    return {
      buffer: Buffer.alloc(0),
      mimeType: "audio/ogg; codecs=opus",
      mode: "empty",
      frameCount: 0,
    };
  }

  const buffer = buildOggOpus(frames);
  return {
    buffer,
    mimeType: "audio/ogg; codecs=opus",
    mode: "ogg-opus-from-rtp-frames",
    frameCount: frames.length,
  };
}

// ---------------------------------------------------------------------------
// Legacy compat — kept so any remaining callers don't break immediately
// ---------------------------------------------------------------------------

/** @deprecated Use packageFramesForStt(frames) instead. */
export function packageObservedPayloadAsPseudoWebm(_payloadBase64: string) {
  return {
    buffer: Buffer.alloc(0),
    mimeType: "audio/webm",
    mode: "deprecated-stub" as const,
  };
}

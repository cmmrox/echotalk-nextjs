import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Resolve the platform-specific FFmpeg binary at server runtime, not while
  // Turbopack traces route modules.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  async headers() {
    return [
      {
        // Required for SharedArrayBuffer (Silero VAD threaded WASM)
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;

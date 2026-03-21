export type SessionStatus =
  | "idle"
  | "starting"
  | "signaling"
  | "connected"
  | "listening"
  | "processing"
  | "speaking"
  | "stopping"
  | "error";

export type SessionSnapshot = {
  sessionId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  events?: Array<{ type: string; at: string; data?: Record<string, unknown> }>;
};

export class WebRtcClientSession {
  private sessionId: string | null = null;
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  get id() {
    return this.sessionId;
  }

  async createSession() {
    const res = await fetch("/api/webrtc/session", { method: "POST" });
    if (!res.ok) throw new Error(`Failed to create session (${res.status})`);
    const data = (await res.json()) as {
      sessionId: string;
      status: string;
      createdAt: string;
    };
    this.sessionId = data.sessionId;
    return data;
  }

  async fetchSnapshot() {
    if (!this.sessionId) throw new Error("Missing session id");
    const res = await fetch(`/api/webrtc/session?sessionId=${this.sessionId}`);
    if (!res.ok) throw new Error(`Failed to fetch session (${res.status})`);
    return (await res.json()) as SessionSnapshot;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  getLocalStream() {
    return this.stream;
  }

  async connect() {
    const session = await this.createSession();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    this.remoteStream = new MediaStream();

    this.stream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, this.stream as MediaStream);
    });

    this.pc.ontrack = (event) => {
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          this.remoteStream?.addTrack(track);
        });
      });
    };

    this.pc.onicecandidate = async (event) => {
      if (!event.candidate || !this.sessionId) return;
      await fetch("/api/webrtc/ice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        }),
      });
    };

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
    });
    await this.pc.setLocalDescription(offer);

    const res = await fetch("/api/webrtc/offer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        sdp: offer.sdp,
        type: offer.type,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to post offer (${res.status})`);
    }

    const data = (await res.json()) as {
      answer?: { sdp: string; type: RTCSdpType };
      message?: string;
      error?: string;
    };

    if (data.answer?.sdp && data.answer?.type) {
      try {
        await this.pc.setRemoteDescription(data.answer);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to apply remote description";
        throw new Error(`Failed to apply WebRTC answer: ${message}`);
      }
    } else {
      throw new Error(data.message || data.error || "Missing WebRTC answer from server");
    }

    return session;
  }

  async stop() {
    this.pc?.close();
    this.pc = null;
    this.remoteStream = null;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.sessionId) {
      await fetch(`/api/webrtc/session?sessionId=${this.sessionId}`, {
        method: "DELETE",
      }).catch(() => null);
    }

    this.sessionId = null;
  }
}

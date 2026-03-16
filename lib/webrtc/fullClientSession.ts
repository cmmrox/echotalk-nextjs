export type FullSessionSnapshot = {
  id?: string;
  sessionId?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  events?: Array<{ type: string; at: string; data?: Record<string, unknown> }>;
  telemetry?: {
    hasInboundTrack: boolean;
    inboundTrack?: {
      kind: string;
      id: string;
      streamId?: string;
      remote: boolean;
      muted: boolean;
      receivedRtpPackets: number;
      receivedBytes: number;
      lastPacketAt?: string;
    } | null;
    segmentation?: {
      packetCount: number;
      totalBytes: number;
      payloadCount?: number;
      startedAt?: string;
      lastPacketAt?: string;
      completedTurns: number;
    } | null;
    turnWindow?: {
      ready: boolean;
      packetCount: number;
      totalBytes: number;
      completedTurns: number;
      lastReadyAt?: string;
    } | null;
    processing?: {
      queued: boolean;
      processing: boolean;
      processedTurns: number;
      lastQueuedAt?: string;
      lastProcessedAt?: string;
    } | null;
    latestResult?: {
      turnNumber: number;
      transcript: string;
      detectedLanguage: string;
      replyText: string;
      replyLanguage: string;
      createdAt: string;
    } | null;
    latestTts?: {
      turnNumber: number;
      contentType: string;
      createdAt: string;
    } | null;
    outboundAudio?: {
      ready: boolean;
      turnNumber?: number;
      contentType?: string;
      createdAt?: string;
      delivered?: boolean;
      deliveredAt?: string;
    } | null;
    /** Full conversation turn history for the transcript UI */
    turns?: Array<{ role: string; text: string; language?: string }>;
    eventCount: number;
    turnCount: number;
  };
};

export class FullWebRtcClientSession {
  private sessionId: string | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  get id() {
    return this.sessionId;
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  async createSession() {
    const res = await fetch("/api/media-service/session", { method: "POST" });
    if (!res.ok) throw new Error(`Failed to create full media session (${res.status})`);
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
    const res = await fetch(
      `/api/media-service/session?sessionId=${this.sessionId}`
    );
    if (!res.ok) throw new Error(`Failed to fetch media session (${res.status})`);
    const data = (await res.json()) as FullSessionSnapshot;
    return {
      ...data,
      sessionId: data.sessionId ?? data.id ?? this.sessionId ?? undefined,
    };
  }

  async connect() {
    const session = await this.createSession();

    this.localStream = await navigator.mediaDevices.getUserMedia({
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

    this.localStream.getTracks().forEach((track) => {
      console.log("[fullClientSession] add local track", {
        kind: track.kind,
        id: track.id,
        enabled: track.enabled,
        muted: (track as MediaStreamTrack).muted,
        readyState: track.readyState,
      });
      this.pc?.addTrack(track, this.localStream as MediaStream);
    });

    this.pc.ontrack = (event) => {
      console.log("[fullClientSession] remote track", {
        streams: event.streams.length,
        trackKind: event.track?.kind,
        trackId: event.track?.id,
      });
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          this.remoteStream?.addTrack(track);
        });
      });
    };

    this.pc.onicecandidate = async (event) => {
      if (!event.candidate || !this.sessionId) return;
      console.log("[fullClientSession] local ICE candidate", {
        sessionId: this.sessionId,
        candidateLength: event.candidate.candidate.length,
      });
      await fetch("/api/media-service/ice", {
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

    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    console.log("[fullClientSession] offer created", {
      type: offer.type,
      sdpLength: offer.sdp?.length ?? 0,
    });
    await this.pc.setLocalDescription(offer);

    const res = await fetch("/api/media-service/offer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        sdp: offer.sdp,
        type: offer.type,
      }),
    });

    const data = (await res.json()) as {
      answer?: { sdp: string; type: RTCSdpType };
      message?: string;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.message || data.error || `Failed full offer (${res.status})`);
    }

    if (!data.answer?.sdp || !data.answer?.type) {
      throw new Error("Missing answer from media service");
    }

    await this.pc.setRemoteDescription(data.answer);
    return session;
  }

  async stop() {
    this.pc?.close();
    this.pc = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.remoteStream = null;

    if (this.sessionId) {
      await fetch(`/api/media-service/session?sessionId=${this.sessionId}`, {
        method: "DELETE",
      }).catch(() => null);
    }

    this.sessionId = null;
  }
}

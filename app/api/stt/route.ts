import { NextResponse } from "next/server";

import { transcribeAudioBuffer } from "@/lib/services/stt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "Missing 'audio' file field in multipart/form-data.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await transcribeAudioBuffer({
      buffer,
      inputMimeType: file.type,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "stt_failed", message },
      { status: 500 }
    );
  }
}

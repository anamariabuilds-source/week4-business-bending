import {
  allowedAudioMimeTypes,
  MAX_AUDIO_BYTES,
  transcriptionSchema,
} from "../ai/contracts";
import { readBodyWithLimit } from "./request-body";

export type GenerateTranscript = (audio: Uint8Array, mimeType: string) => Promise<string>;

function unavailable(errorCode: string, status = 422): Response {
  return Response.json(
    { status: "voice_transcription_unavailable", error_code: errorCode },
    { status },
  );
}

export function createTranscriptionHandler(generateTranscript: GenerateTranscript) {
  return async function POST(request: Request): Promise<Response> {
    const mimeType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (!mimeType || !allowedAudioMimeTypes.includes(mimeType as (typeof allowedAudioMimeTypes)[number])) {
      return unavailable("UNSUPPORTED_AUDIO_TYPE", 415);
    }

    try {
      const audio = await readBodyWithLimit(request, MAX_AUDIO_BYTES);
      if (audio.byteLength === 0) return unavailable("EMPTY_AUDIO");
      const transcript = transcriptionSchema.parse(await generateTranscript(audio, mimeType));
      return Response.json({ status: "available", transcript });
    } catch {
      return unavailable("TRANSCRIPTION_UNAVAILABLE");
    }
  };
}

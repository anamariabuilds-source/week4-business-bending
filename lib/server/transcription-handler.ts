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

    let audio: Uint8Array;
    try {
      audio = await readBodyWithLimit(request, MAX_AUDIO_BYTES);
    } catch {
      return unavailable("BODY_READ_FAILED");
    }

    if (audio.byteLength === 0) return unavailable("EMPTY_AUDIO");

    let transcriptText: string;
    try {
      transcriptText = await generateTranscript(audio, mimeType);
    } catch {
      return unavailable("PROVIDER_REQUEST_FAILED");
    }

    try {
      const transcript = transcriptionSchema.parse(transcriptText);
      return Response.json({ status: "available", transcript });
    } catch {
      return unavailable("TRANSCRIPT_VALIDATION_FAILED");
    }
  };
}

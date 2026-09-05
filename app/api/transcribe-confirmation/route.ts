import { createTranscriptionHandler } from "@/lib/server/transcription-handler";
import { generateTranscript } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const POST = createTranscriptionHandler(generateTranscript);

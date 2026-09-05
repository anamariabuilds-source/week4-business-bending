import "server-only";

import { GoogleGenAI } from "@google/genai";

import {
  analysisOutputSchema,
  type AnalysisRequest,
} from "@/lib/ai/contracts";
import {
  buildAnalysisGenerationRequest,
  buildTranscriptionGenerationRequest,
} from "./gemini-requests";

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_KEY_UNAVAILABLE");
  return new GoogleGenAI({ apiKey });
}

export async function generateTranscript(audio: Uint8Array, mimeType: string): Promise<string> {
  const response = await client().models.generateContent(
    buildTranscriptionGenerationRequest(audio, mimeType),
  );
  return response.text ?? "";
}

export async function generateAnalysis(request: AnalysisRequest): Promise<unknown> {
  const response = await client().models.generateContent(buildAnalysisGenerationRequest(request));

  return analysisOutputSchema.parse(JSON.parse(response.text ?? ""));
}

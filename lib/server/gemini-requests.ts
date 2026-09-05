import type { GenerateContentParameters } from "@google/genai";

import {
  analysisResponseJsonSchema,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  type AnalysisRequest,
} from "../ai/contracts";
import { buildAnalysisPrompt } from "./analysis-prompt";

export function buildTranscriptionGenerationRequest(
  audio: Uint8Array,
  mimeType: string,
): GenerateContentParameters {
  return {
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: Buffer.from(audio).toString("base64"), mimeType } },
          {
            text: "Transcribe this simulated audio accurately. Return transcript text only. Do not analyze evidence, infer identity or authorship, or make any ability or hiring judgment.",
          },
        ],
      },
    ],
    config: { httpOptions: { timeout: GEMINI_TIMEOUT_MS }, temperature: 0 },
  };
}

export function buildAnalysisGenerationRequest(
  request: AnalysisRequest,
): GenerateContentParameters {
  return {
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: buildAnalysisPrompt(request) }] }],
    config: {
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: analysisResponseJsonSchema,
    },
  };
}

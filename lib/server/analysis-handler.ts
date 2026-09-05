import {
  analysisOutputSchema,
  analysisRequestSchema,
  GEMINI_TIMEOUT_MS,
  MAX_ANALYSIS_BODY_BYTES,
  type AnalysisOutput,
  type AnalysisRequest,
} from "../ai/contracts";
import { readBodyWithLimit } from "./request-body";

export type GenerateAnalysis = (request: AnalysisRequest) => Promise<unknown>;

function unavailable(errorCode: string, status = 422): Response {
  return Response.json({ status: "analysis_unavailable", error_code: errorCode }, { status });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Analysis timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function createAnalysisHandler(
  generateAnalysis: GenerateAnalysis,
  timeoutMs = GEMINI_TIMEOUT_MS,
) {
  return async function POST(request: Request): Promise<Response> {
    if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
      return unavailable("INVALID_CONTENT_TYPE", 415);
    }

    try {
      const body = await readBodyWithLimit(request, MAX_ANALYSIS_BODY_BYTES);
      const parsedRequest = analysisRequestSchema.parse(JSON.parse(new TextDecoder().decode(body)));
      const modelOutput = await withTimeout(generateAnalysis(parsedRequest), timeoutMs);
      const interpretation: AnalysisOutput = analysisOutputSchema.parse(modelOutput);
      return Response.json({ status: "available", interpretation });
    } catch {
      return unavailable("ANALYSIS_UNAVAILABLE");
    }
  };
}

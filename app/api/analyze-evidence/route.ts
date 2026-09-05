import { createAnalysisHandler } from "@/lib/server/analysis-handler";
import { generateAnalysis } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const POST = createAnalysisHandler(generateAnalysis);

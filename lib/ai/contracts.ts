import { z } from "zod";

import { DEMO_CASE_ID, DEMO_PROJECT_ID } from "../demo-record/fixture";
import { confirmationResponseSchema } from "../demo-record/schema";

export const GEMINI_MODEL = "gemini-3.5-flash" as const;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_ANALYSIS_BODY_BYTES = 8 * 1024;
export const GEMINI_TIMEOUT_MS = 20_000;

export const allowedAudioMimeTypes = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
] as const;

export const transcriptionSchema = z.string().trim().min(1).max(600);

export const analysisRequestSchema = z
  .object({
    case_id: z.literal(DEMO_CASE_ID),
    project_id: z.literal(DEMO_PROJECT_ID),
    specific_decision: z.literal("Treat blank lead-time cells as missing values rather than zero."),
    confirmation_response: confirmationResponseSchema,
    analysis_authorized: z.literal(true),
  })
  .strict();

const indicatorSchema = z
  .object({
    relevant: z.boolean(),
    detail: z.string().trim().min(1).max(400),
  })
  .strict();

export const analysisOutputSchema = z
  .object({
    specific_decision_reviewed: z.literal(
      "Treat blank lead-time cells as missing values rather than zero.",
    ),
    evidence_status: z.enum([
      "Evidence supports this specific decision",
      "Insufficient evidence",
    ]),
    observable_evidence: z.array(z.string().trim().min(1).max(600)).min(1).max(6),
    source_references: z
      .array(z.enum(["SIM-DEMO-METHOD-01", "SIM-DEMO-CHECK-02"]))
      .min(1)
      .max(6),
    limitations: z.array(z.string().trim().min(1).max(600)).min(1).max(6),
    ambiguities: z.array(indicatorSchema).max(6),
    contradictions: z.array(indicatorSchema).max(6),
  })
  .strict();

export const analysisResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "specific_decision_reviewed",
    "evidence_status",
    "observable_evidence",
    "source_references",
    "limitations",
    "ambiguities",
    "contradictions",
  ],
  properties: {
    specific_decision_reviewed: {
      type: "string",
      enum: ["Treat blank lead-time cells as missing values rather than zero."],
    },
    evidence_status: {
      type: "string",
      enum: ["Evidence supports this specific decision", "Insufficient evidence"],
    },
    observable_evidence: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string" },
    },
    source_references: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", enum: ["SIM-DEMO-METHOD-01", "SIM-DEMO-CHECK-02"] },
    },
    limitations: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string" },
    },
    ambiguities: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["relevant", "detail"],
        properties: { relevant: { type: "boolean" }, detail: { type: "string" } },
      },
    },
    contradictions: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["relevant", "detail"],
        properties: { relevant: { type: "boolean" }, detail: { type: "string" } },
      },
    },
  },
} as const;

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

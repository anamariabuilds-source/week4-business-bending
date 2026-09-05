import {
  analysisRequestSchema,
  type AnalysisOutput,
  type AnalysisRequest,
} from "../ai/contracts";
import { DEMO_CASE_ID, DEMO_PROJECT_ID } from "./fixture";
import { hiringCycleRecordSchema, type HiringCycleRecord } from "./schema";

export function additionalHumanReviewRequired(
  interpretation: HiringCycleRecord["llmInterpretation"],
): boolean {
  return (
    interpretation.analysisStatus === "analysis_unavailable" ||
    interpretation.evidenceStatus === "Insufficient evidence" ||
    interpretation.sourceReferences.length === 0 ||
    interpretation.ambiguities.some((item) => item.relevant) ||
    interpretation.contradictions.some((item) => item.relevant)
  );
}

export function createAnalysisRequest(record: HiringCycleRecord): AnalysisRequest {
  return analysisRequestSchema.parse({
    case_id: DEMO_CASE_ID,
    project_id: DEMO_PROJECT_ID,
    specific_decision: record.projectEvidence.specificDecision,
    confirmation_response: record.confirmation.confirmationResponse,
    analysis_authorized: record.contextAndConsent.analysisAuthorization,
  });
}

export function markAnalysisInProgress(record: HiringCycleRecord): HiringCycleRecord {
  if (!record.contextAndConsent.analysisAuthorization) {
    throw new Error("Analysis authorization is required.");
  }
  return hiringCycleRecordSchema.parse({
    ...record,
    llmInterpretation: { ...record.llmInterpretation, analysisStatus: "analyzing" },
    calculatedResults: { ...record.calculatedResults, additionalHumanReviewRequired: null },
  });
}

export function applyAnalysisOutput(
  record: HiringCycleRecord,
  output: AnalysisOutput,
  analyzedAt: Date = new Date(),
): HiringCycleRecord {
  if (!record.contextAndConsent.analysisAuthorization) {
    throw new Error("Analysis authorization is required.");
  }

  const interpretation: HiringCycleRecord["llmInterpretation"] = {
    analysisStatus: "available",
    evidenceStatus: output.evidence_status,
    specificDecisionReviewed: output.specific_decision_reviewed,
    observableEvidence: output.observable_evidence,
    sourceReferences: output.source_references,
    limitations: output.limitations,
    ambiguities: output.ambiguities,
    contradictions: output.contradictions,
    analyzedAt: analyzedAt.toISOString(),
    modelDisclosure:
      "This is an AI-generated interpretation of simulated demo evidence. It is limited to the specific project decision shown and is not a general assessment of candidate ability.",
  };

  return hiringCycleRecordSchema.parse({
    ...record,
    llmInterpretation: interpretation,
    calculatedResults: {
      ...record.calculatedResults,
      additionalHumanReviewRequired: additionalHumanReviewRequired(interpretation),
    },
  });
}

export function markAnalysisUnavailable(record: HiringCycleRecord): HiringCycleRecord {
  const interpretation: HiringCycleRecord["llmInterpretation"] = {
    analysisStatus: "analysis_unavailable",
    evidenceStatus: null,
    specificDecisionReviewed: null,
    observableEvidence: [],
    sourceReferences: [],
    limitations: [],
    ambiguities: [],
    contradictions: [],
    analyzedAt: null,
    modelDisclosure: null,
  };
  return hiringCycleRecordSchema.parse({
    ...record,
    llmInterpretation: interpretation,
    calculatedResults: { ...record.calculatedResults, additionalHumanReviewRequired: true },
  });
}

import { describe, expect, it } from "vitest";

import type { AnalysisOutput } from "@/lib/ai/contracts";
import { lockCheckpoint1 } from "./checkpoint1";
import {
  authorizeCurrentContext,
  authorizeReviewedTextAnalysis,
  authorizeReviewedVoiceAnalysis,
} from "./consent";
import { createSimulatedDemoRecord } from "./fixture";
import {
  additionalHumanReviewRequired,
  applyAnalysisOutput,
  createAnalysisRequest,
  markAnalysisInProgress,
  markAnalysisUnavailable,
} from "./analysis-state";

const output: AnalysisOutput = {
  specific_decision_reviewed: "Treat blank lead-time cells as missing values rather than zero.",
  evidence_status: "Evidence supports this specific decision",
  observable_evidence: ["The method note distinguishes blank from recorded zero-day lead time."],
  source_references: ["SIM-DEMO-METHOD-01"],
  limitations: ["Simulated project evidence only."],
  ambiguities: [],
  contradictions: [],
};

function analysisAuthorizedRecord() {
  const initial = createSimulatedDemoRecord(new Date("2026-09-04T12:00:00.000Z"));
  const { lockedAt: _lockedAt, ...draft } = initial.checkpoint1Baseline;
  void _lockedAt;
  const locked = lockCheckpoint1(initial, draft, new Date("2026-09-04T12:05:00.000Z"));
  return authorizeReviewedTextAnalysis(
    authorizeCurrentContext(locked),
    "Blank did not mean a recorded zero-day lead time.",
    true,
  );
}

describe("deterministic analysis state", () => {
  it("marks analysis in progress without creating an evidence conclusion", () => {
    const result = markAnalysisInProgress(analysisAuthorizedRecord());
    expect(result.llmInterpretation.analysisStatus).toBe("analyzing");
    expect(result.llmInterpretation.evidenceStatus).toBeNull();
  });

  it("creates the same downstream analysis request for equivalent Text and Voice responses", () => {
    const text = analysisAuthorizedRecord();
    const beforeConfirmation = authorizeCurrentContext(
      lockCheckpoint1(
        createSimulatedDemoRecord(new Date("2026-09-04T12:00:00.000Z")),
        (() => {
          const initial = createSimulatedDemoRecord(new Date("2026-09-04T12:00:00.000Z"));
          const { lockedAt: _lockedAt, ...draft } = initial.checkpoint1Baseline;
          void _lockedAt;
          return draft;
        })(),
        new Date("2026-09-04T12:05:00.000Z"),
      ),
    );
    const voice = authorizeReviewedVoiceAnalysis(
      beforeConfirmation,
      text.confirmation.confirmationResponse ?? "",
      true,
    );

    expect(createAnalysisRequest(voice)).toEqual(createAnalysisRequest(text));
    expect(voice.confirmation.modality).toBe("voice");
    expect(text.confirmation.modality).toBe("text");
  });

  it("maps validated output and does not require extra review for bounded support", () => {
    const result = applyAnalysisOutput(
      analysisAuthorizedRecord(),
      output,
      new Date("2026-09-04T12:10:00.000Z"),
    );
    expect(result.llmInterpretation.analysisStatus).toBe("available");
    expect(result.llmInterpretation.evidenceStatus).toBe("Evidence supports this specific decision");
    expect(result.calculatedResults.additionalHumanReviewRequired).toBe(false);
  });

  it("requires review for insufficient evidence", () => {
    const result = applyAnalysisOutput(analysisAuthorizedRecord(), {
      ...output,
      evidence_status: "Insufficient evidence",
    });
    expect(result.calculatedResults.additionalHumanReviewRequired).toBe(true);
  });

  it.each(["ambiguity", "contradiction"])("requires review for a relevant %s", (kind) => {
    const changed = {
      ...output,
      ambiguities: kind === "ambiguity" ? [{ relevant: true, detail: "Bounded ambiguity" }] : [],
      contradictions:
        kind === "contradiction" ? [{ relevant: true, detail: "Bounded contradiction" }] : [],
    };
    const result = applyAnalysisOutput(analysisAuthorizedRecord(), changed);
    expect(result.calculatedResults.additionalHumanReviewRequired).toBe(true);
  });

  it("requires review when concrete references are absent", () => {
    const interpretation = {
      ...analysisAuthorizedRecord().llmInterpretation,
      analysisStatus: "available" as const,
      evidenceStatus: "Evidence supports this specific decision" as const,
      sourceReferences: [],
    };
    expect(additionalHumanReviewRequired(interpretation)).toBe(true);
  });

  it("maps technical failure to Analysis unavailable and required review", () => {
    const result = markAnalysisUnavailable(analysisAuthorizedRecord());
    expect(result.llmInterpretation.analysisStatus).toBe("analysis_unavailable");
    expect(result.llmInterpretation.evidenceStatus).toBeNull();
    expect(result.calculatedResults.additionalHumanReviewRequired).toBe(true);
  });

  it("never changes costs, outcomes, workflow facts, review, or interest", () => {
    const before = analysisAuthorizedRecord();
    const after = applyAnalysisOutput(before, output);
    expect(after.checkpoint1Baseline).toEqual(before.checkpoint1Baseline);
    expect(after.calculatedResults.currentCost).toEqual(before.calculatedResults.currentCost);
    expect(after.calculatedResults.proposedCost).toEqual(before.calculatedResults.proposedCost);
    expect(after.calculatedResults.actualCost).toBeNull();
    expect(after.calculatedResults.outcome).toBeNull();
    expect(after.calculatedResults.observedSubstitution).toBeNull();
    expect(after.checkpoint3Facts).toEqual(before.checkpoint3Facts);
    expect(after.hiringManagerReview).toEqual(before.hiringManagerReview);
    expect(after.checkpoint2Response).toEqual(before.checkpoint2Response);
  });
});

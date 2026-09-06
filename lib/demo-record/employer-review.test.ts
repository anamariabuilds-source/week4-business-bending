import { describe, expect, it } from "vitest";

import { applyAnalysisOutput } from "./analysis-state";
import { lockCheckpoint1 } from "./checkpoint1";
import {
  authorizeCurrentContext,
  authorizeReviewedTextAnalysis,
  openEmployerReviewStep,
  recordHiringManagerReview,
  recordStatedInterest,
  shareAuthorizedInterpretation,
} from "./consent";
import { createSimulatedDemoRecord } from "./fixture";
import type { Checkpoint1BaselineDraft, HiringCycleRecord } from "./schema";

const CREATED_AT = new Date("2026-09-04T14:00:00.000Z");
const LOCKED_AT = new Date("2026-09-04T14:15:00.000Z");

function shareableRecord(): HiringCycleRecord {
  const record = createSimulatedDemoRecord(CREATED_AT);
  const { lockedAt: _lockedAt, ...draft } = record.checkpoint1Baseline;
  void _lockedAt;
  const locked = lockCheckpoint1(record, draft as Checkpoint1BaselineDraft, LOCKED_AT);
  const authorized = authorizeCurrentContext(locked);
  const analyzed = authorizeReviewedTextAnalysis(
    authorized,
    "A blank did not document a zero-day lead time, so it remained missing.",
    true,
  );
  const available = applyAnalysisOutput(
    analyzed,
    {
      specific_decision_reviewed: "Treat blank lead-time cells as missing values rather than zero.",
      evidence_status: "Evidence supports this specific decision",
      observable_evidence: ["The project distinguishes blank cells from measured zero-day values."],
      source_references: ["SIM-DEMO-METHOD-01"],
      limitations: ["This interpretation is limited to the named inventory-data decision."],
      ambiguities: [],
      contradictions: [],
    },
    LOCKED_AT,
  );
  return shareAuthorizedInterpretation(available);
}

describe("Employer review and stated interest boundaries", () => {
  it("opens employer review only after candidate-authorized valid sharing", () => {
    const record = shareableRecord();
    expect(openEmployerReviewStep(record).metadata.currentStep).toBe(3);
    const locked = lockCheckpoint1(
      createSimulatedDemoRecord(CREATED_AT),
      (() => {
        const record = createSimulatedDemoRecord(CREATED_AT);
        const { lockedAt: _lockedAt, ...draft } = record.checkpoint1Baseline;
        void _lockedAt;
        return draft as Checkpoint1BaselineDraft;
      })(),
      LOCKED_AT,
    );
    expect(() => openEmployerReviewStep(locked)).toThrow(
      "Candidate authorization is required before employer review",
    );
  });

  it("stores separate bounded Hiring Manager review and relevance fields", () => {
    const reviewed = recordHiringManagerReview(
      shareableRecord(),
      "Agree",
      "Relevant",
      "Relevant to the named inventory-data cleaning decision.",
    );

    expect(reviewed.hiringManagerReview).toEqual({
      review: "Agree",
      relevance: "Relevant",
      note: "Relevant to the named inventory-data cleaning decision.",
    });
    expect(reviewed.llmInterpretation.evidenceStatus).toBe("Evidence supports this specific decision");
  });

  it("rejects an overlong Hiring Manager note", () => {
    expect(() =>
      recordHiringManagerReview(shareableRecord(), "Agree", "Relevant", "x".repeat(501)),
    ).toThrow("500 characters or fewer");
  });

  it("requires both review fields before stated interest", () => {
    const record = shareableRecord();
    expect(() => recordStatedInterest(record, "Interested in testing the proof workflow")).toThrow(
      "Hiring Manager review and relevance are required",
    );

    const reviewed = recordHiringManagerReview(record, "Disagree", "Needs further review", null);
    const interested = recordStatedInterest(reviewed, "Interested in testing the proof workflow");
    expect(interested.checkpoint2Response.statedInterest).toBe("Interested in testing the proof workflow");
    expect(interested.hiringManagerReview.review).toBe("Disagree");
  });

  it("never changes evidence, costs, workflow facts, or substitution", () => {
    const before = shareableRecord();
    const after = recordStatedInterest(
      recordHiringManagerReview(before, "Agree", "Relevant", null),
      "Not interested",
    );

    expect(after.llmInterpretation).toEqual(before.llmInterpretation);
    expect(after.checkpoint1Baseline).toEqual(before.checkpoint1Baseline);
    expect(after.calculatedResults).toEqual(before.calculatedResults);
    expect(after.checkpoint3Facts).toEqual(before.checkpoint3Facts);
    expect(after.calculatedResults.outcome).toBeNull();
    expect(after.calculatedResults.observedSubstitution).toBeNull();
    expect(after.calculatedResults.actualCost).toBeNull();
  });
});

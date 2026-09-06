import { describe, expect, it } from "vitest";

import { applyAnalysisOutput } from "./analysis-state";
import { lockCheckpoint1 } from "./checkpoint1";
import { authorizeCurrentContext, authorizeReviewedTextAnalysis, recordHiringManagerReview, recordStatedInterest, shareAuthorizedInterpretation } from "./consent";
import { createSimulatedDemoRecord } from "./fixture";
import { applyCheckpoint3Facts, calculateWorkflowOutcome } from "./outcome";
import type { Checkpoint1BaselineDraft, HiringCycleRecord } from "./schema";

const CREATED_AT = new Date("2026-09-04T14:00:00.000Z");
const LOCKED_AT = new Date("2026-09-04T14:15:00.000Z");

function mainRecord(): HiringCycleRecord {
  const record = createSimulatedDemoRecord(CREATED_AT);
  const { lockedAt: _lockedAt, ...draft } = record.checkpoint1Baseline;
  void _lockedAt;
  const locked = lockCheckpoint1(record, draft as Checkpoint1BaselineDraft, LOCKED_AT);
  const authorized = authorizeCurrentContext(locked);
  const confirmed = authorizeReviewedTextAnalysis(
    authorized,
    "A blank did not document a zero-day lead time, so it remained missing.",
    true,
  );
  const analyzed = applyAnalysisOutput(
    confirmed,
    {
      specific_decision_reviewed: "Treat blank lead-time cells as missing values rather than zero.",
      evidence_status: "Evidence supports this specific decision",
      observable_evidence: ["Blank cells were treated as missing observations."],
      source_references: ["SIM-DEMO-METHOD-01"],
      limitations: ["Limited to the named simulated decision."],
      ambiguities: [],
      contradictions: [],
    },
    LOCKED_AT,
  );
  const shared = shareAuthorizedInterpretation(analyzed);
  const reviewed = recordHiringManagerReview(shared, "Agree", "Relevant", null);
  return recordStatedInterest(reviewed, "Interested in testing the proof workflow");
}

function actualInputs() {
  return {
    talentAcquisitionMinutesPerCandidate: 16,
    talentAcquisitionHourlyRateMxn: 300,
    hiringManagerMinutesPerCandidate: 42,
    hiringManagerHourlyRateMxn: 500,
    externalFeesPerCandidateMxn: 0,
    llmSystemCostPerCandidateMxn: 50,
  };
}

function documentedFacts(overrides: Partial<HiringCycleRecord["checkpoint3Facts"]> = {}) {
  return {
    originalStepRemains: true,
    finalDurationMinutes: 60,
    finalEmployerActiveTimeMinutesPerCandidate: 40,
    equivalentReplacementExists: false,
    finalCandidateVolume: 4,
    actualWorkflowCostInputs: actualInputs(),
    effectiveDate: "2026-09-04",
    approvingRole: "Talent Acquisition Manager",
    simulatedDocumentType: "Simulated workflow memo",
    simulatedDocumentReference: "SIM-WF-2026-01",
    changeDescription: "The original screening task remained unchanged.",
    ...overrides,
  } as HiringCycleRecord["checkpoint3Facts"];
}

describe("Checkpoint 3 deterministic outcomes and costs", () => {
  it("returns Outcome not documented and no substitution when required facts are missing", () => {
    const result = calculateWorkflowOutcome(mainRecord());
    expect(result).toEqual({
      documentationComplete: false,
      outcome: "Outcome not documented",
      observedSubstitution: "Not documented",
      actualCost: null,
      normalizedBaselineAtFinalVolumeMxn: null,
    });
  });

  it("keeps a fully documented unchanged screen and preserves the main cost path", () => {
    const result = applyCheckpoint3Facts(mainRecord(), documentedFacts());
    expect(result.calculatedResults.outcome).toBe("Kept");
    expect(result.calculatedResults.observedSubstitution).toBe("No");
    expect(result.calculatedResults.actualCost).toEqual({ totalMxn: 1920, perCandidateMxn: 480 });
    expect(result.calculatedResults.crossEmployerValidation).toBe("Not validated");
  });

  it("qualifies at exactly 50 percent only when all shortening rules pass", () => {
    const result = calculateWorkflowOutcome(
      mainRecord(),
      documentedFacts({ finalDurationMinutes: 30, finalEmployerActiveTimeMinutesPerCandidate: 20 }),
    );
    expect(result.outcome).toBe("Shortened");
    expect(result.observedSubstitution).toBe("Yes — in this simulated hiring cycle only");
  });

  it("keeps a 49 percent reduction", () => {
    const result = calculateWorkflowOutcome(
      mainRecord(),
      documentedFacts({ finalDurationMinutes: 31, finalEmployerActiveTimeMinutesPerCandidate: 20 }),
    );
    expect(result.outcome).toBe("Kept");
    expect(result.observedSubstitution).toBe("No");
  });

  it.each([
    ["unchanged active time", { finalDurationMinutes: 30, finalEmployerActiveTimeMinutesPerCandidate: 40 }],
    ["equivalent replacement", { finalDurationMinutes: 30, finalEmployerActiveTimeMinutesPerCandidate: 20, equivalentReplacementExists: true }],
  ])("keeps when shortening condition fails: %s", (_label, overrides) => {
    expect(calculateWorkflowOutcome(mainRecord(), documentedFacts(overrides)).outcome).toBe("Kept");
  });

  it("returns Removed only for documented removal without an equivalent replacement", () => {
    const result = calculateWorkflowOutcome(
      mainRecord(),
      documentedFacts({ originalStepRemains: false }),
    );
    expect(result.outcome).toBe("Removed");
    expect(result.observedSubstitution).toBe("Yes — in this simulated hiring cycle only");
  });

  it("normalizes the locked baseline when final volume changes", () => {
    const result = calculateWorkflowOutcome(
      mainRecord(),
      documentedFacts({ finalCandidateVolume: 6 }),
    );
    expect(result.actualCost).toEqual({ totalMxn: 2880, perCandidateMxn: 480 });
    expect(result.normalizedBaselineAtFinalVolumeMxn).toBe(1800);
  });

  it("keeps evidence, review, and stated interest independent from outcome", () => {
    const record = mainRecord();
    const result = applyCheckpoint3Facts(record, documentedFacts({ originalStepRemains: false }));
    expect(result.llmInterpretation.evidenceStatus).toBe("Evidence supports this specific decision");
    expect(result.hiringManagerReview.review).toBe("Agree");
    expect(result.hiringManagerReview.relevance).toBe("Relevant");
    expect(result.checkpoint2Response.statedInterest).toBe("Interested in testing the proof workflow");
    expect(result.calculatedResults.outcome).toBe("Removed");
  });

  it("recalculates stale results when facts change", () => {
    const shortened = applyCheckpoint3Facts(
      mainRecord(),
      documentedFacts({ finalDurationMinutes: 30, finalEmployerActiveTimeMinutesPerCandidate: 20 }),
    );
    expect(shortened.calculatedResults.outcome).toBe("Shortened");

    const missingDocumentation = applyCheckpoint3Facts(
      shortened,
      documentedFacts({ changeDescription: null }),
    );
    expect(missingDocumentation.calculatedResults.outcome).toBe("Outcome not documented");
    expect(missingDocumentation.calculatedResults.observedSubstitution).toBe("Not documented");

    const replacementAdded = applyCheckpoint3Facts(
      shortened,
      documentedFacts({ equivalentReplacementExists: true, finalDurationMinutes: 30, finalEmployerActiveTimeMinutesPerCandidate: 20 }),
    );
    expect(replacementAdded.calculatedResults.outcome).toBe("Kept");
    expect(replacementAdded.calculatedResults.observedSubstitution).toBe("No");
  });
});

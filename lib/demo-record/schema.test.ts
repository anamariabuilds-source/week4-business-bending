import { describe, expect, it } from "vitest";

import { createSimulatedDemoRecord } from "./fixture";
import {
  checkpoint1BaselineDraftSchema,
  checkpoint3FactsSchema,
  confirmationResponseSchema,
  costInputsSchema,
  hiringCycleRecordSchema,
} from "./schema";

describe("structured record validation boundaries", () => {
  it("keeps confirmation text bounded and rejects contact data", () => {
    expect(confirmationResponseSchema.safeParse("A simulated response.").success).toBe(true);
    expect(confirmationResponseSchema.safeParse("x".repeat(601)).success).toBe(false);
    expect(confirmationResponseSchema.safeParse("Email candidate@example.com").success).toBe(false);
    expect(confirmationResponseSchema.safeParse("Call +52 55 1234 5678").success).toBe(false);
  });

  it("rejects non-finite or negative employer cost inputs", () => {
    const valid = {
      talentAcquisitionMinutesPerCandidate: 1,
      talentAcquisitionHourlyRateMxn: 100,
      hiringManagerMinutesPerCandidate: 1,
      hiringManagerHourlyRateMxn: 100,
      externalFeesPerCandidateMxn: 0,
      llmSystemCostPerCandidateMxn: 0,
    };

    expect(costInputsSchema.safeParse(valid).success).toBe(true);
    expect(costInputsSchema.safeParse({ ...valid, externalFeesPerCandidateMxn: -1 }).success).toBe(false);
    expect(costInputsSchema.safeParse({ ...valid, llmSystemCostPerCandidateMxn: Number.NaN }).success).toBe(false);
  });

  it("requires positive baseline volume and duration", () => {
    const record = createSimulatedDemoRecord();
    const { lockedAt: _lockedAt, ...draft } = record.checkpoint1Baseline;
    void _lockedAt;

    expect(checkpoint1BaselineDraftSchema.safeParse(draft).success).toBe(true);
    expect(checkpoint1BaselineDraftSchema.safeParse({ ...draft, originalDurationMinutes: 0 }).success).toBe(false);
    expect(checkpoint1BaselineDraftSchema.safeParse({ ...draft, candidateVolume: 0 }).success).toBe(false);
    expect(checkpoint1BaselineDraftSchema.safeParse({ ...draft, candidateVolume: 1.5 }).success).toBe(false);
  });

  it("keeps Checkpoint 3 facts bounded and allows pending values only where defined", () => {
    const pending = {
      originalStepRemains: null,
      finalDurationMinutes: null,
      finalEmployerActiveTimeMinutesPerCandidate: null,
      equivalentReplacementExists: null,
      finalCandidateVolume: null,
      actualWorkflowCostInputs: null,
      effectiveDate: null,
      approvingRole: null,
      simulatedDocumentType: null,
      simulatedDocumentReference: null,
      changeDescription: null,
    };

    expect(checkpoint3FactsSchema.safeParse(pending).success).toBe(true);
    expect(checkpoint3FactsSchema.safeParse({ ...pending, finalCandidateVolume: 0 }).success).toBe(false);
    expect(checkpoint3FactsSchema.safeParse({ ...pending, changeDescription: "x".repeat(501) }).success).toBe(false);
  });

  it("rejects unknown fields from the persisted record", () => {
    const record = createSimulatedDemoRecord();
    expect(
      hiringCycleRecordSchema.safeParse({ ...record, unexpected: "not persisted" }).success,
    ).toBe(false);
  });
});

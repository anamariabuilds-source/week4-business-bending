import { describe, expect, it } from "vitest";

import { calculateEmployerCost, lockCheckpoint1 } from "./checkpoint1";
import { createSimulatedDemoRecord } from "./fixture";
import { hiringCycleRecordSchema, type Checkpoint1BaselineDraft } from "./schema";
import { loadDemoRecord, saveDemoRecord } from "./storage";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const CREATED_AT = new Date("2026-09-03T18:00:00.000Z");
const LOCKED_AT = new Date("2026-09-03T18:15:00.000Z");

function fixtureDraft(): Checkpoint1BaselineDraft {
  const { lockedAt: _lockedAt, ...draft } = createSimulatedDemoRecord(CREATED_AT).checkpoint1Baseline;
  void _lockedAt;
  return draft;
}

describe("employer-side cost arithmetic", () => {
  it("calculates the fixture current cost", () => {
    const draft = fixtureDraft();

    expect(calculateEmployerCost(draft.currentScreeningCostInputs, draft.candidateVolume)).toEqual({
      perCandidateMxn: 300,
      totalMxn: 1200,
    });
  });

  it("calculates the fixture proposed Proof cost", () => {
    const draft = fixtureDraft();

    expect(
      calculateEmployerCost(draft.proposedProofWorkflowCostInputs, draft.candidateVolume),
    ).toEqual({ perCandidateMxn: 180, totalMxn: 720 });
  });

  it("does not accept or include candidate time", () => {
    const draft = fixtureDraft();
    const before = calculateEmployerCost(draft.currentScreeningCostInputs, draft.candidateVolume);
    const withDifferentCandidateTime = { ...draft, candidateTimeMinutesPerCandidate: 999 };
    const after = calculateEmployerCost(
      withDifferentCandidateTime.currentScreeningCostInputs,
      withDifferentCandidateTime.candidateVolume,
    );

    expect(after).toEqual(before);
  });

  it("includes external fees and LLM/system cost only when present in the selected inputs", () => {
    const result = calculateEmployerCost(
      {
        talentAcquisitionMinutesPerCandidate: 0,
        talentAcquisitionHourlyRateMxn: 0,
        hiringManagerMinutesPerCandidate: 0,
        hiringManagerHourlyRateMxn: 0,
        externalFeesPerCandidateMxn: 12.5,
        llmSystemCostPerCandidateMxn: 7.25,
      },
      2,
    );

    expect(result).toEqual({ perCandidateMxn: 19.75, totalMxn: 39.5 });
  });

  it("rounds per-candidate and raw-total results to two decimals", () => {
    const result = calculateEmployerCost(
      {
        talentAcquisitionMinutesPerCandidate: 1,
        talentAcquisitionHourlyRateMxn: 100,
        hiringManagerMinutesPerCandidate: 0,
        hiringManagerHourlyRateMxn: 0,
        externalFeesPerCandidateMxn: 0,
        llmSystemCostPerCandidateMxn: 0,
      },
      3,
    );

    expect(result).toEqual({ perCandidateMxn: 1.67, totalMxn: 5 });
  });

  it("accepts zero-valued cost components", () => {
    expect(
      calculateEmployerCost(
        {
          talentAcquisitionMinutesPerCandidate: 0,
          talentAcquisitionHourlyRateMxn: 0,
          hiringManagerMinutesPerCandidate: 0,
          hiringManagerHourlyRateMxn: 0,
          externalFeesPerCandidateMxn: 0,
          llmSystemCostPerCandidateMxn: 0,
        },
        1,
      ),
    ).toEqual({ perCandidateMxn: 0, totalMxn: 0 });
  });

  it.each([
    ["negative minutes", { talentAcquisitionMinutesPerCandidate: -1 }, 1],
    ["non-finite rate", { talentAcquisitionHourlyRateMxn: Number.POSITIVE_INFINITY }, 1],
    ["zero volume", {}, 0],
    ["fractional volume", {}, 1.5],
  ])("rejects %s", (_label, inputChange, volume) => {
    const inputs = { ...fixtureDraft().currentScreeningCostInputs, ...inputChange };

    expect(() => calculateEmployerCost(inputs, volume)).toThrow();
  });
});

describe("Checkpoint 1 lock", () => {
  it("locks validated inputs and stores separate current and proposed costs", () => {
    const locked = lockCheckpoint1(createSimulatedDemoRecord(CREATED_AT), fixtureDraft(), LOCKED_AT);

    expect(locked.checkpoint1Baseline.lockedAt).toBe("2026-09-03T18:15:00.000Z");
    expect(locked.calculatedResults.currentCost).toEqual({
      perCandidateMxn: 300,
      totalMxn: 1200,
    });
    expect(locked.calculatedResults.proposedCost).toEqual({
      perCandidateMxn: 180,
      totalMxn: 720,
    });
    expect(locked.calculatedResults.actualCost).toBeNull();
  });

  it("keeps outcome and observed substitution null", () => {
    const locked = lockCheckpoint1(createSimulatedDemoRecord(CREATED_AT), fixtureDraft(), LOCKED_AT);

    expect(locked.calculatedResults.outcome).toBeNull();
    expect(locked.calculatedResults.observedSubstitution).toBeNull();
    expect(locked.calculatedResults.documentationComplete).toBeNull();
  });

  it("rejects invalid baseline input", () => {
    const invalidDraft = { ...fixtureDraft(), originalDurationMinutes: 0 };

    expect(() =>
      lockCheckpoint1(createSimulatedDemoRecord(CREATED_AT), invalidDraft, LOCKED_AT),
    ).toThrow();
  });

  it.each([
    "Contact demo.person@example.com about the spreadsheet screen",
    "Call +52 55 1234 5678 about the spreadsheet screen",
  ])("rejects obvious contact data in the free-text baseline field", (existingScreeningStep) => {
    const invalidDraft = { ...fixtureDraft(), existingScreeningStep };

    expect(() =>
      lockCheckpoint1(createSimulatedDemoRecord(CREATED_AT), invalidDraft, LOCKED_AT),
    ).toThrow("Use simulated content without email addresses or phone numbers.");
  });

  it("rejects a second lock instead of changing locked values", () => {
    const locked = lockCheckpoint1(createSimulatedDemoRecord(CREATED_AT), fixtureDraft(), LOCKED_AT);
    const changedDraft = { ...fixtureDraft(), candidateVolume: 12 };

    expect(() => lockCheckpoint1(locked, changedDraft, new Date("2026-09-03T19:00:00.000Z"))).toThrow(
      "Checkpoint 1 is already locked.",
    );
  });

  it("preserves locked data and costs through storage reload", () => {
    const storage = new MemoryStorage();
    const locked = lockCheckpoint1(createSimulatedDemoRecord(CREATED_AT), fixtureDraft(), LOCKED_AT);
    saveDemoRecord(storage, locked);

    const reloaded = loadDemoRecord(storage, new Date("2026-09-04T00:00:00.000Z"));

    expect(reloaded).toEqual(locked);
    expect(reloaded?.checkpoint1Baseline.lockedAt).toBe("2026-09-03T18:15:00.000Z");
  });

  it("is independent of evidence status, Hiring Manager relevance, and stated interest", () => {
    const plain = createSimulatedDemoRecord(CREATED_AT);
    const unrelatedClaimsChanged = hiringCycleRecordSchema.parse({
      ...plain,
      llmInterpretation: {
        ...plain.llmInterpretation,
        analysisStatus: "available",
        evidenceStatus: "Evidence supports this specific decision",
      },
      hiringManagerReview: {
        ...plain.hiringManagerReview,
        relevance: "Relevant",
      },
      checkpoint2Response: {
        statedInterest: "Interested in testing the proof workflow",
      },
    });

    const first = lockCheckpoint1(plain, fixtureDraft(), LOCKED_AT);
    const second = lockCheckpoint1(unrelatedClaimsChanged, fixtureDraft(), LOCKED_AT);

    expect(second.checkpoint1Baseline).toEqual(first.checkpoint1Baseline);
    expect(second.calculatedResults).toEqual(first.calculatedResults);
    expect(second.calculatedResults.outcome).toBeNull();
    expect(second.calculatedResults.observedSubstitution).toBeNull();
  });
});

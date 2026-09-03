import {
  checkpoint1BaselineDraftSchema,
  hiringCycleRecordSchema,
  type Checkpoint1BaselineDraft,
  type CostInputs,
  type HiringCycleRecord,
} from "./schema";

export type EmployerCost = {
  perCandidateMxn: number;
  totalMxn: number;
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEmployerCost(inputs: CostInputs, candidateVolume: number): EmployerCost {
  const validatedInputs = hiringCycleRecordSchema.shape.checkpoint1Baseline.shape
    .currentScreeningCostInputs.parse(inputs);
  const validatedVolume = checkpoint1BaselineDraftSchema.shape.candidateVolume.parse(candidateVolume);
  const rawPerCandidate =
    (validatedInputs.talentAcquisitionMinutesPerCandidate / 60) *
      validatedInputs.talentAcquisitionHourlyRateMxn +
    (validatedInputs.hiringManagerMinutesPerCandidate / 60) *
      validatedInputs.hiringManagerHourlyRateMxn +
    validatedInputs.externalFeesPerCandidateMxn +
    validatedInputs.llmSystemCostPerCandidateMxn;

  return {
    perCandidateMxn: roundCurrency(rawPerCandidate),
    totalMxn: roundCurrency(rawPerCandidate * validatedVolume),
  };
}

export function lockCheckpoint1(
  record: HiringCycleRecord,
  draft: Checkpoint1BaselineDraft,
  now: Date = new Date(),
): HiringCycleRecord {
  if (record.checkpoint1Baseline.lockedAt !== null) {
    throw new Error("Checkpoint 1 is already locked.");
  }

  const validatedDraft = checkpoint1BaselineDraftSchema.parse(draft);
  const currentCost = calculateEmployerCost(
    validatedDraft.currentScreeningCostInputs,
    validatedDraft.candidateVolume,
  );
  const proposedCost = calculateEmployerCost(
    validatedDraft.proposedProofWorkflowCostInputs,
    validatedDraft.candidateVolume,
  );

  return hiringCycleRecordSchema.parse({
    ...record,
    checkpoint1Baseline: {
      ...validatedDraft,
      lockedAt: now.toISOString(),
    },
    calculatedResults: {
      ...record.calculatedResults,
      currentCost,
      proposedCost,
      actualCost: null,
      documentationComplete: null,
      outcome: null,
      observedSubstitution: null,
      normalizedBaselineAtFinalVolumeMxn: null,
    },
  });
}

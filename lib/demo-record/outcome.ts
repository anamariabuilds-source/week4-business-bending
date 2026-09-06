import { canEmployerViewEvidence } from "./consent";
import { calculateEmployerCost, type EmployerCost } from "./checkpoint1";
import {
  checkpoint3FactsSchema,
  hiringCycleRecordSchema,
  type HiringCycleRecord,
} from "./schema";

export type WorkflowOutcome = "Outcome not documented" | "Kept" | "Shortened" | "Removed";

export type OutcomeCalculation = {
  documentationComplete: boolean;
  outcome: WorkflowOutcome;
  observedSubstitution: "Not documented" | "No" | "Yes — in this simulated hiring cycle only";
  actualCost: EmployerCost | null;
  normalizedBaselineAtFinalVolumeMxn: number | null;
};

function requiredText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

export function isCheckpoint3Documented(
  facts: HiringCycleRecord["checkpoint3Facts"],
): boolean {
  return (
    facts.originalStepRemains !== null &&
    facts.finalDurationMinutes !== null &&
    facts.finalEmployerActiveTimeMinutesPerCandidate !== null &&
    facts.equivalentReplacementExists !== null &&
    facts.finalCandidateVolume !== null &&
    facts.actualWorkflowCostInputs !== null &&
    requiredText(facts.effectiveDate) &&
    requiredText(facts.approvingRole) &&
    requiredText(facts.simulatedDocumentType) &&
    requiredText(facts.simulatedDocumentReference) &&
    requiredText(facts.changeDescription)
  );
}

export function calculateWorkflowOutcome(
  record: HiringCycleRecord,
  facts: HiringCycleRecord["checkpoint3Facts"] = record.checkpoint3Facts,
): OutcomeCalculation {
  const validatedFacts = checkpoint3FactsSchema.parse(facts);
  const documented = isCheckpoint3Documented(validatedFacts);
  if (!documented) {
    return {
      documentationComplete: false,
      outcome: "Outcome not documented",
      observedSubstitution: "Not documented",
      actualCost: null,
      normalizedBaselineAtFinalVolumeMxn: null,
    };
  }

  const finalVolume = validatedFacts.finalCandidateVolume;
  const actualInputs = validatedFacts.actualWorkflowCostInputs;
  const finalDuration = validatedFacts.finalDurationMinutes;
  const finalActiveTime = validatedFacts.finalEmployerActiveTimeMinutesPerCandidate;
  if (finalVolume === null || actualInputs === null || finalDuration === null || finalActiveTime === null) {
    throw new Error("Documented Checkpoint 3 facts are incomplete.");
  }

  const durationReductionPercent =
    ((record.checkpoint1Baseline.originalDurationMinutes - finalDuration) /
      record.checkpoint1Baseline.originalDurationMinutes) *
    100;
  const noEquivalentReplacement = validatedFacts.equivalentReplacementExists === false;
  const activeTimeDecreased =
    finalActiveTime < record.checkpoint1Baseline.employerActiveTimeMinutesPerCandidate;

  let outcome: WorkflowOutcome = "Kept";
  if (!validatedFacts.originalStepRemains && noEquivalentReplacement) {
    outcome = "Removed";
  } else if (
    validatedFacts.originalStepRemains &&
    durationReductionPercent >= record.checkpoint1Baseline.simulatedMaterialityThresholdPercent &&
    activeTimeDecreased &&
    noEquivalentReplacement
  ) {
    outcome = "Shortened";
  }

  const actualCost = calculateEmployerCost(actualInputs, finalVolume);
  const normalizedBaselineAtFinalVolumeMxn =
    finalVolume === record.checkpoint1Baseline.candidateVolume
      ? null
      : calculateEmployerCost(
          record.checkpoint1Baseline.currentScreeningCostInputs,
          finalVolume,
        ).totalMxn;

  return {
    documentationComplete: true,
    outcome,
    observedSubstitution:
      outcome === "Kept"
        ? "No"
        : "Yes — in this simulated hiring cycle only",
    actualCost,
    normalizedBaselineAtFinalVolumeMxn,
  };
}

export function applyCheckpoint3Facts(
  record: HiringCycleRecord,
  facts: HiringCycleRecord["checkpoint3Facts"],
): HiringCycleRecord {
  const validatedFacts = checkpoint3FactsSchema.parse(facts);
  const calculation = calculateWorkflowOutcome(record, validatedFacts);
  return hiringCycleRecordSchema.parse({
    ...record,
    checkpoint3Facts: validatedFacts,
    calculatedResults: {
      ...record.calculatedResults,
      ...calculation,
    },
  });
}

export function openFinalOutcomeStep(record: HiringCycleRecord): HiringCycleRecord {
  if (!record.checkpoint1Baseline.lockedAt) {
    throw new Error("Checkpoint 1 must be locked before final workflow facts.");
  }
  if (
    !canEmployerViewEvidence(record) ||
    record.hiringManagerReview.review === null ||
    record.hiringManagerReview.relevance === null
  ) {
    throw new Error("Authorized employer review is required before final workflow facts.");
  }
  return hiringCycleRecordSchema.parse({
    ...applyCheckpoint3Facts(record, record.checkpoint3Facts),
    metadata: { ...record.metadata, currentStep: 4 },
  });
}

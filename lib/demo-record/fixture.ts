import { DEMO_SCHEMA_VERSION, hiringCycleRecordSchema, type HiringCycleRecord } from "./schema";

export const DEMO_CASE_ID = "empresa-demo-mx-sc-2026-01";
export const DEMO_PROJECT_ID = "inventory-analysis-project-demo-01";

export function createSimulatedDemoRecord(
  now: Date = new Date(),
  caseId: string = DEMO_CASE_ID,
): HiringCycleRecord {
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  return hiringCycleRecordSchema.parse({
    metadata: {
      schemaVersion: DEMO_SCHEMA_VERSION,
      demoLabel: "SIMULATED DEMO DATA",
      caseId,
      createdAt,
      expiresAt,
      currentStep: 1,
    },
    contextAndConsent: {
      authorizedRecipient: "Empresa Demo MX — Talent Acquisition Manager",
      employer: "Empresa Demo MX",
      role: "Entry-Level Supply Chain Analyst",
      purpose: "Evaluate evidence for one inventory-data cleaning decision",
      hiringCycle: "SC-2026-01",
      contextAuthorization: "not_recorded",
      analysisAuthorization: false,
      finalSharingDecision: null,
      sharingStatus: "not_authorized",
    },
    projectEvidence: {
      projectId: DEMO_PROJECT_ID,
      projectTitle: "SIMULATED DEMO DATA — University Inventory Analysis Project",
      isPreExistingProject: true,
      specificDecision: "Treat blank lead-time cells as missing values rather than zero.",
      sourceExcerpts: [
        {
          sourceId: "SIM-DEMO-METHOD-01",
          excerpt:
            "Blank lead-time cells were preserved as missing because a blank did not document a zero-day supplier lead time.",
        },
        {
          sourceId: "SIM-DEMO-CHECK-02",
          excerpt:
            "Rows with missing lead time were flagged for follow-up and excluded from calculations that required a recorded lead-time value.",
        },
      ],
      noRelevantProjectAvailable: false,
    },
    confirmation: {
      prompt:
        "Why did you treat blank lead-time cells as missing values rather than zero when preparing the inventory analysis?",
      modality: null,
      confirmationResponse: null,
      transcriptReviewState: null,
      voiceTechnicalState: null,
    },
    llmInterpretation: {
      analysisStatus: "not_requested",
      evidenceStatus: null,
      specificDecisionReviewed: null,
      observableEvidence: [],
      sourceReferences: [],
      limitations: [],
      ambiguities: [],
      contradictions: [],
      analyzedAt: null,
      modelDisclosure: null,
    },
    hiringManagerReview: {
      review: null,
      relevance: null,
      note: null,
    },
    checkpoint1Baseline: {
      existingScreeningStep:
        "Required employer-created spreadsheet task focused on an inventory-data cleaning decision",
      originalDurationMinutes: 60,
      employerActiveTimeMinutesPerCandidate: 40,
      currentScreeningCostInputs: {
        talentAcquisitionMinutesPerCandidate: 10,
        talentAcquisitionHourlyRateMxn: 300,
        hiringManagerMinutesPerCandidate: 30,
        hiringManagerHourlyRateMxn: 500,
        externalFeesPerCandidateMxn: 0,
        llmSystemCostPerCandidateMxn: 0,
      },
      candidateTimeMinutesPerCandidate: 60,
      candidateVolume: 4,
      proposedProofWorkflowCostInputs: {
        talentAcquisitionMinutesPerCandidate: 6,
        talentAcquisitionHourlyRateMxn: 300,
        hiringManagerMinutesPerCandidate: 12,
        hiringManagerHourlyRateMxn: 500,
        externalFeesPerCandidateMxn: 0,
        llmSystemCostPerCandidateMxn: 50,
      },
      simulatedMaterialityThresholdPercent: 50,
      lockedAt: null,
    },
    checkpoint2Response: {
      statedInterest: "Not recorded",
    },
    checkpoint3Facts: {
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
    },
    calculatedResults: {
      documentationComplete: null,
      outcome: null,
      observedSubstitution: null,
      currentCost: null,
      proposedCost: null,
      actualCost: null,
      normalizedBaselineAtFinalVolumeMxn: null,
      crossEmployerValidation: "Not validated",
    },
  });
}

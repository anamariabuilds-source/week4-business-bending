import { z } from "zod";

export const DEMO_SCHEMA_VERSION = 1 as const;

const isoDateTime = z.iso.datetime({ offset: true });
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const obviousEmailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const obviousPhonePattern = /(?:\+?\d[\s().-]*){10,}/;
const boundedDemoText = (maximum: number) =>
  boundedText(maximum).refine(
    (value) => !obviousEmailPattern.test(value) && !obviousPhonePattern.test(value),
    "Use simulated content without email addresses or phone numbers.",
  );
export const confirmationResponseSchema = boundedDemoText(600);
const nonNegativeNumber = z.number().finite().min(0);
const positiveNumber = z.number().finite().positive();

export const costInputsSchema = z
  .object({
    talentAcquisitionMinutesPerCandidate: nonNegativeNumber,
    talentAcquisitionHourlyRateMxn: nonNegativeNumber,
    hiringManagerMinutesPerCandidate: nonNegativeNumber,
    hiringManagerHourlyRateMxn: nonNegativeNumber,
    externalFeesPerCandidateMxn: nonNegativeNumber,
    llmSystemCostPerCandidateMxn: nonNegativeNumber,
  })
  .strict();

export const checkpoint1BaselineDraftSchema = z
  .object({
    existingScreeningStep: boundedDemoText(300),
    originalDurationMinutes: positiveNumber,
    employerActiveTimeMinutesPerCandidate: nonNegativeNumber,
    currentScreeningCostInputs: costInputsSchema,
    candidateTimeMinutesPerCandidate: nonNegativeNumber,
    candidateVolume: z.number().int().positive().max(1000),
    proposedProofWorkflowCostInputs: costInputsSchema,
    simulatedMaterialityThresholdPercent: z.literal(50),
  })
  .strict();

const calculatedCostSchema = z
  .object({
    totalMxn: nonNegativeNumber,
    perCandidateMxn: nonNegativeNumber,
  })
  .strict();

export const hiringCycleRecordSchema = z
  .object({
    metadata: z
      .object({
        schemaVersion: z.literal(DEMO_SCHEMA_VERSION),
        demoLabel: z.literal("SIMULATED DEMO DATA"),
        caseId: boundedText(100),
        createdAt: isoDateTime,
        expiresAt: isoDateTime,
        currentStep: z.number().int().min(1).max(4),
      })
      .strict(),
    contextAndConsent: z
      .object({
        authorizedRecipient: boundedText(120),
        employer: boundedText(120),
        role: boundedText(120),
        purpose: boundedText(240),
        hiringCycle: boundedText(80),
        contextAuthorization: z.enum(["not_recorded", "authorized", "declined"]),
        analysisAuthorization: z.boolean(),
        finalSharingDecision: z.enum(["share", "request_human_review", "do_not_share"]).nullable(),
        sharingStatus: z.enum([
          "not_authorized",
          "authorized",
          "paused_pending_review",
          "declined",
        ]),
      })
      .strict(),
    projectEvidence: z
      .object({
        projectId: boundedText(100),
        projectTitle: boundedText(160),
        isPreExistingProject: z.literal(true),
        specificDecision: boundedText(300),
        sourceExcerpts: z
          .array(
            z
              .object({
                sourceId: boundedText(80),
                excerpt: boundedText(800),
              })
              .strict(),
          )
          .min(1)
          .max(10),
        noRelevantProjectAvailable: z.boolean(),
      })
      .strict(),
    confirmation: z
      .object({
        prompt: boundedText(600),
        modality: z.enum(["text", "voice"]).nullable(),
        confirmationResponse: confirmationResponseSchema.nullable(),
        transcriptReviewState: z.enum(["not_applicable", "pending", "reviewed"]).nullable(),
        voiceTechnicalState: z
          .enum(["not_started", "recording", "transcribing", "available", "unavailable"])
          .nullable(),
      })
      .strict(),
    llmInterpretation: z
      .object({
        analysisStatus: z.enum(["not_requested", "available", "analysis_unavailable"]),
        evidenceStatus: z
          .enum(["Evidence supports this specific decision", "Insufficient evidence"])
          .nullable(),
        specificDecisionReviewed: z.string().max(300).nullable(),
        observableEvidence: z.array(boundedText(600)).max(10),
        sourceReferences: z.array(boundedText(80)).max(10),
        limitations: z.array(boundedText(600)).max(10),
        ambiguities: z
          .array(z.object({ relevant: z.boolean(), detail: boundedText(400) }).strict())
          .max(10),
        contradictions: z
          .array(z.object({ relevant: z.boolean(), detail: boundedText(400) }).strict())
          .max(10),
        analyzedAt: isoDateTime.nullable(),
        modelDisclosure: z.string().max(400).nullable(),
      })
      .strict(),
    hiringManagerReview: z
      .object({
        review: z.enum(["Agree", "Disagree", "Needs further review"]).nullable(),
        relevance: z.enum(["Relevant", "Not relevant", "Needs further review"]).nullable(),
        note: z.string().max(500).nullable(),
      })
      .strict(),
    checkpoint1Baseline: checkpoint1BaselineDraftSchema
      .extend({
        lockedAt: isoDateTime.nullable(),
      })
      .strict(),
    checkpoint2Response: z
      .object({
        statedInterest: z.enum([
          "Interested in testing the proof workflow",
          "Needs more information",
          "Not interested",
          "Not recorded",
        ]),
      })
      .strict(),
    checkpoint3Facts: z
      .object({
        originalStepRemains: z.boolean().nullable(),
        finalDurationMinutes: nonNegativeNumber.nullable(),
        finalEmployerActiveTimeMinutesPerCandidate: nonNegativeNumber.nullable(),
        equivalentReplacementExists: z.boolean().nullable(),
        finalCandidateVolume: z.number().int().positive().max(1000).nullable(),
        actualWorkflowCostInputs: costInputsSchema.nullable(),
        effectiveDate: z.iso.date().nullable(),
        approvingRole: z.string().max(120).nullable(),
        simulatedDocumentType: z.string().max(120).nullable(),
        simulatedDocumentReference: z.string().max(120).nullable(),
        changeDescription: z.string().max(500).nullable(),
      })
      .strict(),
    calculatedResults: z
      .object({
        documentationComplete: z.boolean().nullable(),
        outcome: z.enum(["Outcome not documented", "Kept", "Shortened", "Removed"]).nullable(),
        observedSubstitution: z
          .enum([
            "Not documented",
            "No",
            "Yes — in this simulated hiring cycle only",
          ])
          .nullable(),
        currentCost: calculatedCostSchema.nullable(),
        proposedCost: calculatedCostSchema.nullable(),
        actualCost: calculatedCostSchema.nullable(),
        normalizedBaselineAtFinalVolumeMxn: nonNegativeNumber.nullable(),
        crossEmployerValidation: z.literal("Not validated"),
      })
      .strict(),
  })
  .strict();

export type HiringCycleRecord = z.infer<typeof hiringCycleRecordSchema>;
export type ContextAndConsent = HiringCycleRecord["contextAndConsent"];
export type CostInputs = z.infer<typeof costInputsSchema>;
export type Checkpoint1BaselineDraft = z.infer<typeof checkpoint1BaselineDraftSchema>;

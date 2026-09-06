import {
  confirmationResponseSchema,
  hiringCycleRecordSchema,
  type HiringCycleRecord,
} from "./schema";

function requireLockedBaseline(record: HiringCycleRecord): void {
  if (record.checkpoint1Baseline.lockedAt === null) {
    throw new Error("Checkpoint 1 must be locked before Candidate consent.");
  }
}

function clearedConfirmation() {
  return {
    modality: null,
    confirmationResponse: null,
    transcriptReviewState: null,
    voiceTechnicalState: null,
  } as const;
}

function clearedInterpretation() {
  return {
    analysisStatus: "not_requested" as const,
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
}

export function openCandidateStep(record: HiringCycleRecord): HiringCycleRecord {
  requireLockedBaseline(record);
  return hiringCycleRecordSchema.parse({
    ...record,
    metadata: { ...record.metadata, currentStep: 2 },
  });
}

export function openBaselineStep(record: HiringCycleRecord): HiringCycleRecord {
  return hiringCycleRecordSchema.parse({
    ...record,
    metadata: { ...record.metadata, currentStep: 1 },
  });
}

export function openEmployerReviewStep(record: HiringCycleRecord): HiringCycleRecord {
  requireLockedBaseline(record);
  if (!canEmployerViewEvidence(record)) {
    throw new Error("Candidate authorization is required before employer review.");
  }
  return hiringCycleRecordSchema.parse({
    ...record,
    metadata: { ...record.metadata, currentStep: 3 },
  });
}

export function recordHiringManagerReview(
  record: HiringCycleRecord,
  review: NonNullable<HiringCycleRecord["hiringManagerReview"]["review"]>,
  relevance: NonNullable<HiringCycleRecord["hiringManagerReview"]["relevance"]>,
  note: string | null,
): HiringCycleRecord {
  requireLockedBaseline(record);
  if (!canEmployerViewEvidence(record)) {
    throw new Error("Candidate authorization is required before employer review.");
  }
  const boundedNote = note === null ? null : note.trim();
  if (boundedNote !== null && boundedNote.length > 500) {
    throw new Error("Hiring Manager note must be 500 characters or fewer.");
  }
  return hiringCycleRecordSchema.parse({
    ...record,
    hiringManagerReview: { review, relevance, note: boundedNote },
  });
}

export function recordStatedInterest(
  record: HiringCycleRecord,
  statedInterest: HiringCycleRecord["checkpoint2Response"]["statedInterest"],
): HiringCycleRecord {
  requireLockedBaseline(record);
  if (!canEmployerViewEvidence(record)) {
    throw new Error("Candidate authorization is required before stated interest.");
  }
  if (
    record.hiringManagerReview.review === null ||
    record.hiringManagerReview.relevance === null
  ) {
    throw new Error("Hiring Manager review and relevance are required before stated interest.");
  }
  return hiringCycleRecordSchema.parse({
    ...record,
    checkpoint2Response: { statedInterest },
  });
}

export function authorizeCurrentContext(record: HiringCycleRecord): HiringCycleRecord {
  requireLockedBaseline(record);
  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      contextAuthorization: "authorized",
      analysisAuthorization: false,
      finalSharingDecision: null,
      sharingStatus: "not_authorized",
    },
    projectEvidence: {
      ...record.projectEvidence,
      noRelevantProjectAvailable: false,
    },
    confirmation: {
      prompt: record.confirmation.prompt,
      ...clearedConfirmation(),
    },
    llmInterpretation: clearedInterpretation(),
    calculatedResults: {
      ...record.calculatedResults,
      additionalHumanReviewRequired: null,
    },
  });
}

export function declineSharing(record: HiringCycleRecord): HiringCycleRecord {
  requireLockedBaseline(record);
  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      contextAuthorization: "declined",
      analysisAuthorization: false,
      finalSharingDecision: "do_not_share",
      sharingStatus: "declined",
    },
    projectEvidence: {
      ...record.projectEvidence,
      noRelevantProjectAvailable: false,
    },
    confirmation: {
      prompt: record.confirmation.prompt,
      ...clearedConfirmation(),
    },
    llmInterpretation: clearedInterpretation(),
    calculatedResults: {
      ...record.calculatedResults,
      additionalHumanReviewRequired: null,
    },
  });
}

export function selectNoRelevantProject(record: HiringCycleRecord): HiringCycleRecord {
  requireLockedBaseline(record);
  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      contextAuthorization: "not_recorded",
      analysisAuthorization: false,
      finalSharingDecision: null,
      sharingStatus: "not_authorized",
    },
    projectEvidence: {
      ...record.projectEvidence,
      noRelevantProjectAvailable: true,
    },
    confirmation: {
      prompt: record.confirmation.prompt,
      ...clearedConfirmation(),
    },
    llmInterpretation: clearedInterpretation(),
    calculatedResults: {
      ...record.calculatedResults,
      additionalHumanReviewRequired: null,
    },
  });
}

export function authorizeReviewedTextAnalysis(
  record: HiringCycleRecord,
  response: string,
  wasReviewed: boolean,
): HiringCycleRecord {
  requireLockedBaseline(record);
  if (record.contextAndConsent.contextAuthorization !== "authorized") {
    throw new Error("Authorize this context before analysis.");
  }
  if (!wasReviewed) {
    throw new Error("Review the Text response before analysis.");
  }

  const approvedResponse = confirmationResponseSchema.parse(response);

  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      analysisAuthorization: true,
      finalSharingDecision: null,
      sharingStatus: "not_authorized",
    },
    projectEvidence: {
      ...record.projectEvidence,
      noRelevantProjectAvailable: false,
    },
    confirmation: {
      prompt: record.confirmation.prompt,
      modality: "text",
      confirmationResponse: approvedResponse,
      transcriptReviewState: "not_applicable",
      voiceTechnicalState: null,
    },
    llmInterpretation: {
      ...clearedInterpretation(),
      analysisStatus: "not_requested",
    },
    calculatedResults: {
      ...record.calculatedResults,
      additionalHumanReviewRequired: null,
    },
  });
}

export function authorizeReviewedVoiceAnalysis(
  record: HiringCycleRecord,
  response: string,
  wasReviewed: boolean,
): HiringCycleRecord {
  const approved = authorizeReviewedTextAnalysis(record, response, wasReviewed);
  return hiringCycleRecordSchema.parse({
    ...approved,
    confirmation: {
      ...approved.confirmation,
      modality: "voice",
      transcriptReviewState: "reviewed",
      voiceTechnicalState: "available",
    },
  });
}

export function requestHumanReview(record: HiringCycleRecord): HiringCycleRecord {
  requireLockedBaseline(record);
  if (!record.contextAndConsent.analysisAuthorization) {
    throw new Error("Analysis authorization is required before requesting human review.");
  }

  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      finalSharingDecision: "request_human_review",
      sharingStatus: "paused_pending_review",
    },
  });
}

export function shareAuthorizedInterpretation(record: HiringCycleRecord): HiringCycleRecord {
  requireLockedBaseline(record);
  if (
    !record.contextAndConsent.analysisAuthorization ||
    record.llmInterpretation.analysisStatus !== "available" ||
    record.llmInterpretation.evidenceStatus === null ||
    record.llmInterpretation.specificDecisionReviewed === null ||
    record.llmInterpretation.sourceReferences.length === 0 ||
    record.llmInterpretation.observableEvidence.length === 0 ||
    record.llmInterpretation.limitations.length === 0
  ) {
    throw new Error("A valid interpretation is required before sharing.");
  }

  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      finalSharingDecision: "share",
      sharingStatus: "authorized",
    },
  });
}

export function canEmployerViewEvidence(record: HiringCycleRecord): boolean {
  return (
    record.contextAndConsent.analysisAuthorization &&
    record.contextAndConsent.finalSharingDecision === "share" &&
    record.contextAndConsent.sharingStatus === "authorized" &&
    record.llmInterpretation.analysisStatus === "available" &&
    record.llmInterpretation.evidenceStatus !== null &&
    record.llmInterpretation.specificDecisionReviewed !== null &&
    record.llmInterpretation.sourceReferences.length > 0 &&
    record.llmInterpretation.observableEvidence.length > 0 &&
    record.llmInterpretation.limitations.length > 0
  );
}

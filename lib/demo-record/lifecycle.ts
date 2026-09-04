import { hiringCycleRecordSchema, type ContextAndConsent, type HiringCycleRecord } from "./schema";

export function isDemoRecordExpired(record: HiringCycleRecord, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(record.metadata.expiresAt).getTime();
}

type ContextIdentity = Pick<
  ContextAndConsent,
  "employer" | "role" | "purpose" | "hiringCycle"
>;

export function updateContext(
  record: HiringCycleRecord,
  changes: Partial<ContextIdentity>,
): HiringCycleRecord {
  const contextChanged = (Object.keys(changes) as Array<keyof ContextIdentity>).some(
    (key) => changes[key] !== undefined && changes[key] !== record.contextAndConsent[key],
  );

  if (!contextChanged) {
    return record;
  }

  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      ...changes,
      contextAuthorization: "not_recorded",
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
  });
}

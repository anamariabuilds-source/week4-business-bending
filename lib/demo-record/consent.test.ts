import { describe, expect, it } from "vitest";

import { lockCheckpoint1 } from "./checkpoint1";
import {
  authorizeCurrentContext,
  authorizeReviewedTextAnalysis,
  canEmployerViewEvidence,
  declineSharing,
  openCandidateStep,
  requestHumanReview,
  selectNoRelevantProject,
  shareAuthorizedInterpretation,
} from "./consent";
import { createSimulatedDemoRecord } from "./fixture";
import { updateContext } from "./lifecycle";
import type { Checkpoint1BaselineDraft, HiringCycleRecord } from "./schema";
import { loadDemoRecord, saveDemoRecord } from "./storage";

const CREATED_AT = new Date("2026-09-04T14:00:00.000Z");
const LOCKED_AT = new Date("2026-09-04T14:15:00.000Z");

function lockedRecord(): HiringCycleRecord {
  const record = createSimulatedDemoRecord(CREATED_AT);
  const { lockedAt: _lockedAt, ...draft } = record.checkpoint1Baseline;
  void _lockedAt;
  return lockCheckpoint1(record, draft as Checkpoint1BaselineDraft, LOCKED_AT);
}

function authorizedContextRecord(): HiringCycleRecord {
  return authorizeCurrentContext(lockedRecord());
}

function authorizedAnalysisRecord(): HiringCycleRecord {
  return authorizeReviewedTextAnalysis(
    authorizedContextRecord(),
    "A blank did not document a zero-day lead time, so it remained missing.",
    true,
  );
}

describe("Candidate entry and context consent", () => {
  it("blocks the Candidate flow until Checkpoint 1 is locked", () => {
    expect(() => openCandidateStep(createSimulatedDemoRecord(CREATED_AT))).toThrow(
      "Checkpoint 1 must be locked",
    );
  });

  it("blocks a decline transition until Checkpoint 1 is locked", () => {
    expect(() => declineSharing(createSimulatedDemoRecord(CREATED_AT))).toThrow(
      "Checkpoint 1 must be locked",
    );
  });

  it("authorizes only the displayed context without authorizing analysis or sharing", () => {
    const authorized = authorizeCurrentContext(lockedRecord());

    expect(authorized.contextAndConsent.contextAuthorization).toBe("authorized");
    expect(authorized.contextAndConsent.analysisAuthorization).toBe(false);
    expect(authorized.contextAndConsent.sharingStatus).toBe("not_authorized");
    expect(canEmployerViewEvidence(authorized)).toBe(false);
  });

  it("declining clears confirmation and blocks employer visibility", () => {
    const declined = declineSharing(authorizedAnalysisRecord());

    expect(declined.contextAndConsent.contextAuthorization).toBe("declined");
    expect(declined.contextAndConsent.analysisAuthorization).toBe(false);
    expect(declined.contextAndConsent.finalSharingDecision).toBe("do_not_share");
    expect(declined.contextAndConsent.sharingStatus).toBe("declined");
    expect(declined.confirmation.confirmationResponse).toBeNull();
    expect(declined.llmInterpretation.evidenceStatus).toBeNull();
    expect(canEmployerViewEvidence(declined)).toBe(false);
  });
});

describe("Text review and temporary analysis placeholder", () => {
  it("requires context authorization", () => {
    expect(() =>
      authorizeReviewedTextAnalysis(lockedRecord(), "A reviewed simulated response.", true),
    ).toThrow("Authorize this context before analysis.");
  });

  it("requires a distinct review step", () => {
    const unchangedRecord = authorizedContextRecord();
    expect(() =>
      authorizeReviewedTextAnalysis(unchangedRecord, "Not reviewed yet.", false),
    ).toThrow("Review the Text response before analysis.");
    expect(unchangedRecord.confirmation.confirmationResponse).toBeNull();
    expect(unchangedRecord.contextAndConsent.analysisAuthorization).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["over limit", "x".repeat(601)],
    ["email", "Contact candidate@example.com about this simulated response."],
    ["phone", "Call +52 55 1234 5678 about this simulated response."],
  ])("rejects %s Text content", (_label, response) => {
    expect(() =>
      authorizeReviewedTextAnalysis(authorizedContextRecord(), response, true),
    ).toThrow();
  });

  it("persists only the reviewed response and creates no evidence conclusion", () => {
    const result = authorizedAnalysisRecord();

    expect(result.confirmation.modality).toBe("text");
    expect(result.confirmation.confirmationResponse).toBe(
      "A blank did not document a zero-day lead time, so it remained missing.",
    );
    expect(result.contextAndConsent.analysisAuthorization).toBe(true);
    expect(result.llmInterpretation.analysisStatus).toBe("not_requested");
    expect(result.llmInterpretation.evidenceStatus).toBeNull();
    expect(canEmployerViewEvidence(result)).toBe(false);
  });

  it("preserves the approved Text response and placeholder through storage reload", () => {
    const values = new Map<string, string>();
    const storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const approved = authorizedAnalysisRecord();
    saveDemoRecord(storage, approved);

    const reloaded = loadDemoRecord(storage, new Date("2026-09-05T14:00:00.000Z"));

    expect(reloaded?.confirmation.confirmationResponse).toBe(
      "A blank did not document a zero-day lead time, so it remained missing.",
    );
    expect(reloaded?.llmInterpretation.analysisStatus).toBe("not_requested");
    expect(reloaded?.llmInterpretation.evidenceStatus).toBeNull();
  });
});

describe("no-project and final sharing boundaries", () => {
  it("keeps no relevant project distinct from insufficient evidence", () => {
    const noProject = selectNoRelevantProject(authorizedAnalysisRecord());

    expect(noProject.projectEvidence.noRelevantProjectAvailable).toBe(true);
    expect(noProject.contextAndConsent.analysisAuthorization).toBe(false);
    expect(noProject.confirmation.confirmationResponse).toBeNull();
    expect(noProject.llmInterpretation.analysisStatus).toBe("not_requested");
    expect(noProject.llmInterpretation.evidenceStatus).toBeNull();
    expect(canEmployerViewEvidence(noProject)).toBe(false);
  });

  it("pauses sharing when human review is requested", () => {
    const paused = requestHumanReview(authorizedAnalysisRecord());

    expect(paused.contextAndConsent.finalSharingDecision).toBe("request_human_review");
    expect(paused.contextAndConsent.sharingStatus).toBe("paused_pending_review");
    expect(canEmployerViewEvidence(paused)).toBe(false);
  });

  it("rejects Share before a validated analysis exists", () => {
    expect(() => shareAuthorizedInterpretation(authorizedAnalysisRecord())).toThrow(
      "A valid interpretation is required before sharing.",
    );
  });

  it("context changes invalidate authorization and sharing", () => {
    const paused = requestHumanReview(authorizedAnalysisRecord());
    const changed = updateContext(paused, { hiringCycle: "SC-2026-02" });

    expect(changed.contextAndConsent.contextAuthorization).toBe("not_recorded");
    expect(changed.contextAndConsent.analysisAuthorization).toBe(false);
    expect(changed.contextAndConsent.finalSharingDecision).toBeNull();
    expect(changed.contextAndConsent.sharingStatus).toBe("not_authorized");
    expect(changed.confirmation.confirmationResponse).toBeNull();
    expect(canEmployerViewEvidence(changed)).toBe(false);
  });

  it("does not change locked costs, workflow facts, outcomes, review, or interest", () => {
    const before = lockedRecord();
    const after = requestHumanReview(
      authorizeReviewedTextAnalysis(authorizeCurrentContext(before), "Reviewed demo response.", true),
    );

    expect(after.checkpoint1Baseline).toEqual(before.checkpoint1Baseline);
    expect(after.calculatedResults).toEqual(before.calculatedResults);
    expect(after.checkpoint3Facts).toEqual(before.checkpoint3Facts);
    expect(after.hiringManagerReview).toEqual(before.hiringManagerReview);
    expect(after.checkpoint2Response).toEqual(before.checkpoint2Response);
    expect(after.calculatedResults.outcome).toBeNull();
    expect(after.calculatedResults.observedSubstitution).toBeNull();
    expect(after.calculatedResults.actualCost).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { createSimulatedDemoRecord } from "./fixture";
import { isDemoRecordExpired, updateContext } from "./lifecycle";
import { hiringCycleRecordSchema, type HiringCycleRecord } from "./schema";
import {
  deleteDemoRecord,
  DEMO_RECORD_STORAGE_KEY,
  loadDemoRecord,
  saveDemoRecord,
} from "./storage";

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
const BEFORE_EXPIRY = new Date("2026-12-02T17:59:59.999Z");
const AT_EXPIRY = new Date("2026-12-02T18:00:00.000Z");

function authorizedRecord(): HiringCycleRecord {
  const record = createSimulatedDemoRecord(CREATED_AT);

  return hiringCycleRecordSchema.parse({
    ...record,
    contextAndConsent: {
      ...record.contextAndConsent,
      contextAuthorization: "authorized",
      analysisAuthorization: true,
      finalSharingDecision: "share",
      sharingStatus: "authorized",
    },
    llmInterpretation: {
      ...record.llmInterpretation,
      analysisStatus: "available",
      evidenceStatus: "Evidence supports this specific decision",
      specificDecisionReviewed: record.projectEvidence.specificDecision,
      observableEvidence: ["A bounded observation"],
      sourceReferences: ["SIM-DEMO-METHOD-01"],
      limitations: ["Simulated evidence only"],
      analyzedAt: "2026-09-03T18:05:00.000Z",
      modelDisclosure: "AI-generated interpretation of simulated demo evidence.",
    },
    hiringManagerReview: {
      review: "Agree",
      relevance: "Relevant",
      note: null,
    },
  });
}

describe("simulated record schema and fixture", () => {
  it("creates a valid versioned record with a 90-day expiry", () => {
    const record = createSimulatedDemoRecord(CREATED_AT);

    expect(hiringCycleRecordSchema.safeParse(record).success).toBe(true);
    expect(record.metadata.createdAt).toBe("2026-09-03T18:00:00.000Z");
    expect(record.metadata.expiresAt).toBe("2026-12-02T18:00:00.000Z");
    expect(record.metadata.demoLabel).toBe("SIMULATED DEMO DATA");
  });

  it("stores raw cost inputs without calculating cost results", () => {
    const record = createSimulatedDemoRecord(CREATED_AT);

    expect(record.checkpoint1Baseline.currentScreeningCostInputs).toMatchObject({
      talentAcquisitionMinutesPerCandidate: 10,
      hiringManagerMinutesPerCandidate: 30,
    });
    expect(record.checkpoint1Baseline.proposedProofWorkflowCostInputs).toMatchObject({
      talentAcquisitionMinutesPerCandidate: 6,
      hiringManagerMinutesPerCandidate: 12,
      llmSystemCostPerCandidateMxn: 50,
    });
    expect(record.calculatedResults.currentCost).toBeNull();
    expect(record.calculatedResults.proposedCost).toBeNull();
    expect(record.calculatedResults.actualCost).toBeNull();
  });

  it("rejects an audio field anywhere in the strict persisted confirmation schema", () => {
    const recordWithAudio = {
      ...createSimulatedDemoRecord(CREATED_AT),
      confirmation: {
        ...createSimulatedDemoRecord(CREATED_AT).confirmation,
        audio: "data:audio/webm;base64,not-permitted",
      },
    };

    expect(hiringCycleRecordSchema.safeParse(recordWithAudio).success).toBe(false);
  });
});

describe("record lifecycle", () => {
  it("is not expired before expiresAt", () => {
    expect(isDemoRecordExpired(createSimulatedDemoRecord(CREATED_AT), BEFORE_EXPIRY)).toBe(false);
  });

  it("is expired exactly at expiresAt", () => {
    expect(isDemoRecordExpired(createSimulatedDemoRecord(CREATED_AT), AT_EXPIRY)).toBe(true);
  });

  it("is expired after expiresAt", () => {
    expect(
      isDemoRecordExpired(
        createSimulatedDemoRecord(CREATED_AT),
        new Date("2026-12-02T18:00:00.001Z"),
      ),
    ).toBe(true);
  });

  it.each([
    ["employer", "Another Simulated Employer"],
    ["role", "Another Simulated Role"],
    ["purpose", "Another simulated purpose"],
    ["hiringCycle", "SC-2026-02"],
  ] as const)("invalidates consent and sharing when %s changes", (field, value) => {
    const updated = updateContext(authorizedRecord(), { [field]: value });

    expect(updated.contextAndConsent[field]).toBe(value);
    expect(updated.contextAndConsent.contextAuthorization).toBe("not_recorded");
    expect(updated.contextAndConsent.analysisAuthorization).toBe(false);
    expect(updated.contextAndConsent.finalSharingDecision).toBeNull();
    expect(updated.contextAndConsent.sharingStatus).toBe("not_authorized");
    expect(updated.llmInterpretation.analysisStatus).toBe("not_requested");
    expect(updated.hiringManagerReview.review).toBeNull();
  });

  it("preserves the record and consent when context is unchanged", () => {
    const record = authorizedRecord();
    const updated = updateContext(record, { employer: record.contextAndConsent.employer });

    expect(updated).toBe(record);
    expect(updated.contextAndConsent.analysisAuthorization).toBe(true);
  });
});

describe("single-record storage adapter", () => {
  it("persists and reloads a valid non-expired record", () => {
    const storage = new MemoryStorage();
    const record = createSimulatedDemoRecord(CREATED_AT);

    saveDemoRecord(storage, record);

    expect(loadDemoRecord(storage, BEFORE_EXPIRY)).toEqual(record);
  });

  it("returns null without automatically creating a record", () => {
    const storage = new MemoryStorage();

    expect(loadDemoRecord(storage, CREATED_AT)).toBeNull();
    expect(storage.getItem(DEMO_RECORD_STORAGE_KEY)).toBeNull();
  });

  it("rejects an invalid record before persistence", () => {
    const storage = new MemoryStorage();
    const invalidRecord = {
      ...createSimulatedDemoRecord(CREATED_AT),
      metadata: {
        ...createSimulatedDemoRecord(CREATED_AT).metadata,
        schemaVersion: 2,
      },
    } as unknown as HiringCycleRecord;

    expect(() => saveDemoRecord(storage, invalidRecord)).toThrow();
    expect(storage.getItem(DEMO_RECORD_STORAGE_KEY)).toBeNull();
  });

  it("removes an expired record and does not create a replacement", () => {
    const storage = new MemoryStorage();
    saveDemoRecord(storage, createSimulatedDemoRecord(CREATED_AT));

    expect(loadDemoRecord(storage, AT_EXPIRY)).toBeNull();
    expect(storage.getItem(DEMO_RECORD_STORAGE_KEY)).toBeNull();
  });

  it("removes malformed or schema-invalid stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_RECORD_STORAGE_KEY, JSON.stringify({ metadata: { schemaVersion: 1 } }));

    expect(loadDemoRecord(storage, CREATED_AT)).toBeNull();
    expect(storage.getItem(DEMO_RECORD_STORAGE_KEY)).toBeNull();
  });

  it("deletes the complete demo record immediately", () => {
    const storage = new MemoryStorage();
    saveDemoRecord(storage, createSimulatedDemoRecord(CREATED_AT));

    deleteDemoRecord(storage);

    expect(loadDemoRecord(storage, CREATED_AT)).toBeNull();
    expect(storage.getItem(DEMO_RECORD_STORAGE_KEY)).toBeNull();
  });
});

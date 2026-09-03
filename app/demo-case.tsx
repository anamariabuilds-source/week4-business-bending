"use client";

import { useEffect, useState, type FormEvent } from "react";

import { calculateEmployerCost, lockCheckpoint1, type EmployerCost } from "@/lib/demo-record/checkpoint1";
import { createSimulatedDemoRecord } from "@/lib/demo-record/fixture";
import {
  checkpoint1BaselineDraftSchema,
  type Checkpoint1BaselineDraft,
  type CostInputs,
  type HiringCycleRecord,
} from "@/lib/demo-record/schema";
import {
  deleteDemoRecord,
  loadDemoRecord,
  saveDemoRecord,
} from "@/lib/demo-record/storage";

type CostPrefix = "current" | "proposed";

function numberValue(formData: FormData, key: string): number {
  return Number(formData.get(key));
}

function costInputsFromForm(formData: FormData, prefix: CostPrefix): CostInputs {
  return {
    talentAcquisitionMinutesPerCandidate: numberValue(formData, `${prefix}TaMinutes`),
    talentAcquisitionHourlyRateMxn: numberValue(formData, `${prefix}TaRate`),
    hiringManagerMinutesPerCandidate: numberValue(formData, `${prefix}HmMinutes`),
    hiringManagerHourlyRateMxn: numberValue(formData, `${prefix}HmRate`),
    externalFeesPerCandidateMxn: numberValue(formData, `${prefix}ExternalFees`),
    llmSystemCostPerCandidateMxn: numberValue(formData, `${prefix}SystemCost`),
  };
}

function checkpointDraftFromForm(formData: FormData): Checkpoint1BaselineDraft {
  return checkpoint1BaselineDraftSchema.parse({
    existingScreeningStep: formData.get("existingScreeningStep"),
    originalDurationMinutes: numberValue(formData, "originalDurationMinutes"),
    employerActiveTimeMinutesPerCandidate: numberValue(formData, "employerActiveTimeMinutes"),
    currentScreeningCostInputs: costInputsFromForm(formData, "current"),
    candidateTimeMinutesPerCandidate: numberValue(formData, "candidateTimeMinutes"),
    candidateVolume: numberValue(formData, "candidateVolume"),
    proposedProofWorkflowCostInputs: costInputsFromForm(formData, "proposed"),
    simulatedMaterialityThresholdPercent: 50,
  });
}

function calculatePreview(draft: Checkpoint1BaselineDraft) {
  return {
    current: calculateEmployerCost(draft.currentScreeningCostInputs, draft.candidateVolume),
    proposed: calculateEmployerCost(draft.proposedProofWorkflowCostInputs, draft.candidateVolume),
  };
}

function formatMxn(value: number): string {
  return new Intl.NumberFormat("en-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function CostSummary({ label, cost }: { label: string; cost: EmployerCost }) {
  return (
    <div className="cost-summary">
      <h3>{label}</h3>
      <p className="cost-total">{formatMxn(cost.totalMxn)} total</p>
      <p>{formatMxn(cost.perCandidateMxn)} per candidate</p>
    </div>
  );
}

function NumberField({
  defaultValue,
  label,
  min = 0,
  name,
  step = "any",
}: {
  defaultValue: number;
  label: string;
  min?: number;
  name: string;
  step?: number | "any";
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input defaultValue={defaultValue} min={min} name={name} required step={step} type="number" />
    </label>
  );
}

function CostFields({
  heading,
  inputs,
  prefix,
}: {
  heading: string;
  inputs: CostInputs;
  prefix: CostPrefix;
}) {
  return (
    <fieldset>
      <legend>{heading}</legend>
      <div className="field-grid">
        <NumberField
          defaultValue={inputs.talentAcquisitionMinutesPerCandidate}
          label="Talent Acquisition minutes per candidate"
          name={`${prefix}TaMinutes`}
        />
        <NumberField
          defaultValue={inputs.talentAcquisitionHourlyRateMxn}
          label="Talent Acquisition hourly rate (MXN)"
          name={`${prefix}TaRate`}
        />
        <NumberField
          defaultValue={inputs.hiringManagerMinutesPerCandidate}
          label="Hiring Manager minutes per candidate"
          name={`${prefix}HmMinutes`}
        />
        <NumberField
          defaultValue={inputs.hiringManagerHourlyRateMxn}
          label="Hiring Manager hourly rate (MXN)"
          name={`${prefix}HmRate`}
        />
        <NumberField
          defaultValue={inputs.externalFeesPerCandidateMxn}
          label="External fees per candidate (MXN)"
          name={`${prefix}ExternalFees`}
        />
        <NumberField
          defaultValue={inputs.llmSystemCostPerCandidateMxn}
          label="LLM/system cost per candidate (MXN)"
          name={`${prefix}SystemCost`}
        />
      </div>
    </fieldset>
  );
}

export function DemoCase() {
  const [record, setRecord] = useState<HiringCycleRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof calculatePreview> | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => {
      const storedRecord = loadDemoRecord(window.localStorage);
      setRecord(storedRecord);
      if (storedRecord !== null && storedRecord.checkpoint1Baseline.lockedAt === null) {
        const { lockedAt, ...draft } = storedRecord.checkpoint1Baseline;
        void lockedAt;
        setPreview(calculatePreview(draft));
      }
      setIsLoaded(true);
    });

    return () => window.cancelAnimationFrame(hydrationFrame);
  }, []);

  function createCase() {
    const nextRecord = createSimulatedDemoRecord();
    const { lockedAt, ...draft } = nextRecord.checkpoint1Baseline;
    void lockedAt;
    saveDemoRecord(window.localStorage, nextRecord);
    setRecord(nextRecord);
    setPreview(calculatePreview(draft));
    setValidationMessage(null);
  }

  function deleteCase() {
    deleteDemoRecord(window.localStorage);
    setRecord(null);
    setPreview(null);
    setValidationMessage(null);
  }

  function updatePreview(event: FormEvent<HTMLFormElement>) {
    const result = checkpoint1BaselineDraftSchema.safeParse(
      (() => {
        try {
          return checkpointDraftFromForm(new FormData(event.currentTarget));
        } catch {
          return null;
        }
      })(),
    );

    if (result.success) {
      setPreview(calculatePreview(result.data));
      setValidationMessage(null);
    }
  }

  function submitCheckpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (record === null) return;

    try {
      const draft = checkpointDraftFromForm(new FormData(event.currentTarget));
      const lockedRecord = lockCheckpoint1(record, draft);
      saveDemoRecord(window.localStorage, lockedRecord);
      setRecord(lockedRecord);
      setPreview(null);
      setValidationMessage(null);
    } catch {
      setValidationMessage(
        "Review the entered values. Use valid non-negative numbers and simulated text without contact information.",
      );
    }
  }

  if (!isLoaded) {
    return (
      <section className="case-state" aria-live="polite">
        <p>Checking for a saved simulated demo case…</p>
      </section>
    );
  }

  if (record === null) {
    return (
      <section className="case-state" aria-labelledby="empty-case-title">
        <p className="eyebrow">No active case</p>
        <h2 id="empty-case-title">Create a simulated demo case</h2>
        <p className="placeholder-copy">
          No case is created automatically. This browser will store one invented demo record only
          after you choose to create it.
        </p>
        <button className="primary-action" type="button" onClick={createCase}>
          Create simulated demo case
        </button>
      </section>
    );
  }

  const baseline = record.checkpoint1Baseline;
  const lockedAt = baseline.lockedAt;
  const isLocked = lockedAt !== null;

  return (
    <section className="case-state" aria-labelledby="active-case-title">
      <p className="eyebrow">Step {record.metadata.currentStep} of 4</p>
      <h2 id="active-case-title">Baseline Setup</h2>
      <p className="case-label">{record.metadata.demoLabel}</p>
      <dl className="case-context">
        <div>
          <dt>Employer</dt>
          <dd>{record.contextAndConsent.employer}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{record.contextAndConsent.role}</dd>
        </div>
        <div>
          <dt>Hiring cycle</dt>
          <dd>{record.contextAndConsent.hiringCycle}</dd>
        </div>
      </dl>

      {isLocked ? (
        <div className="locked-checkpoint">
          <p className="lock-status">Checkpoint 1 locked</p>
          <p>
            Locked on <time dateTime={lockedAt ?? undefined}>{lockedAt ? new Date(lockedAt).toLocaleString("en-MX") : ""}</time>.
            Delete the complete demo case to begin a new baseline.
          </p>
          <dl className="baseline-summary">
            <div><dt>Existing screen</dt><dd>{baseline.existingScreeningStep}</dd></div>
            <div><dt>Original duration</dt><dd>{baseline.originalDurationMinutes} minutes</dd></div>
            <div><dt>Employer active time</dt><dd>{baseline.employerActiveTimeMinutesPerCandidate} minutes per candidate</dd></div>
            <div><dt>Candidate volume</dt><dd>{baseline.candidateVolume}</dd></div>
            <div><dt>Candidate time</dt><dd>{baseline.candidateTimeMinutesPerCandidate} minutes per candidate — excluded from employer cost</dd></div>
            <div><dt>Simulated pilot rule</dt><dd>{baseline.simulatedMaterialityThresholdPercent}% material-shortening threshold</dd></div>
          </dl>
          <div className="cost-comparison" aria-label="Locked employer-side cost estimates">
            {record.calculatedResults.currentCost && <CostSummary label="Current screening cost" cost={record.calculatedResults.currentCost} />}
            {record.calculatedResults.proposedCost && <CostSummary label="Proposed Proof-workflow cost" cost={record.calculatedResults.proposedCost} />}
          </div>
        </div>
      ) : (
        <form className="baseline-form" onInput={updatePreview} onSubmit={submitCheckpoint}>
          <p className="form-intro">
            Enter invented demo values only. Lock these assumptions before the simulated workflow outcome is known.
          </p>
          <label className="field field-wide">
            <span>Existing screening step</span>
            <textarea defaultValue={baseline.existingScreeningStep} maxLength={300} name="existingScreeningStep" required rows={3} />
          </label>
          <div className="field-grid">
            <NumberField defaultValue={baseline.originalDurationMinutes} label="Original duration (minutes)" min={0.01} name="originalDurationMinutes" />
            <NumberField defaultValue={baseline.employerActiveTimeMinutesPerCandidate} label="Employer active time per candidate (minutes)" name="employerActiveTimeMinutes" />
            <NumberField defaultValue={baseline.candidateTimeMinutesPerCandidate} label="Candidate time per candidate (minutes, tracked separately)" name="candidateTimeMinutes" />
            <NumberField defaultValue={baseline.candidateVolume} label="Candidate volume" min={1} name="candidateVolume" step={1} />
          </div>
          <CostFields heading="Current screening cost inputs" inputs={baseline.currentScreeningCostInputs} prefix="current" />
          <CostFields heading="Proposed Proof-workflow cost inputs" inputs={baseline.proposedProofWorkflowCostInputs} prefix="proposed" />
          <div className="threshold-note">
            <strong>Simulated pilot rule: 50% material-shortening threshold.</strong>
            <span>This pre-registered demo rule is not an employer benchmark or accessibility standard.</span>
          </div>
          {preview && (
            <div className="cost-comparison" aria-live="polite" aria-label="Employer-side cost preview">
              <CostSummary label="Current screening cost" cost={preview.current} />
              <CostSummary label="Proposed Proof-workflow cost" cost={preview.proposed} />
            </div>
          )}
          <p className="candidate-time-note">Candidate time is tracked separately and is not included in employer cost.</p>
          {validationMessage && <p className="validation-message" role="alert">{validationMessage}</p>}
          <button className="primary-action" type="submit">Lock Checkpoint 1</button>
        </form>
      )}

      <button className="secondary-action" type="button" onClick={deleteCase}>
        Delete demo case
      </button>
    </section>
  );
}

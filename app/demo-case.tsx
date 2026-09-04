"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { calculateEmployerCost, lockCheckpoint1, type EmployerCost } from "@/lib/demo-record/checkpoint1";
import {
  authorizeCurrentContext,
  authorizeReviewedTextAnalysis,
  declineSharing,
  openBaselineStep,
  openCandidateStep,
  requestHumanReview,
  selectNoRelevantProject,
} from "@/lib/demo-record/consent";
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

const workflowSteps = [
  "Baseline Setup",
  "Candidate Consent & Evidence",
  "Evidence Review & Interest",
  "Final Workflow Outcome",
] as const;

function Workspace({
  children,
  currentStep = 1,
}: {
  children: ReactNode;
  currentStep?: number;
}) {
  return (
    <div className="workspace">
      <nav className="step-navigation" aria-label="Workflow steps">
        <ol>
          {workflowSteps.map((step, index) => {
            const stepNumber = index + 1;
            return (
              <li key={step} aria-current={stepNumber === currentStep ? "step" : undefined}>
                <span className="step-number" aria-hidden="true">{stepNumber}</span>
                <span>{step}</span>
              </li>
            );
          })}
        </ol>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}

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
  const [draftResponse, setDraftResponse] = useState("");
  const [isReviewingResponse, setIsReviewingResponse] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);

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
    setDraftResponse("");
    setIsReviewingResponse(false);
    setShowHandoff(false);
  }

  function persistRecord(nextRecord: HiringCycleRecord) {
    saveDemoRecord(window.localStorage, nextRecord);
    setRecord(nextRecord);
  }

  function goToCandidateStep() {
    if (record !== null) persistRecord(openCandidateStep(record));
  }

  function goToBaselineStep() {
    if (record !== null) persistRecord(openBaselineStep(record));
  }

  function chooseContextAuthorization() {
    if (record === null) return;
    persistRecord(authorizeCurrentContext(record));
    setDraftResponse("");
    setIsReviewingResponse(false);
    setValidationMessage(null);
  }

  function chooseDoNotShare() {
    if (record === null) return;
    persistRecord(declineSharing(record));
    setDraftResponse("");
    setIsReviewingResponse(false);
    setValidationMessage(null);
  }

  function chooseNoProject() {
    if (record === null) return;
    persistRecord(selectNoRelevantProject(record));
    setDraftResponse("");
    setIsReviewingResponse(false);
    setShowHandoff(false);
    setValidationMessage(null);
  }

  function authorizeTextAnalysis() {
    if (record === null) return;
    try {
      persistRecord(authorizeReviewedTextAnalysis(record, draftResponse, isReviewingResponse));
      setValidationMessage(null);
    } catch {
      setValidationMessage(
        "Use 1–600 characters of simulated content without an email address or phone number.",
      );
    }
  }

  function pauseForHumanReview() {
    if (record !== null) persistRecord(requestHumanReview(record));
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
      <Workspace>
        <section className="case-state" aria-live="polite">
          <p>Checking for a saved simulated demo case…</p>
        </section>
      </Workspace>
    );
  }

  if (record === null) {
    return (
      <Workspace>
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
      </Workspace>
    );
  }

  const baseline = record.checkpoint1Baseline;
  const lockedAt = baseline.lockedAt;
  const isLocked = lockedAt !== null;

  if (record.metadata.currentStep === 2) {
    const consent = record.contextAndConsent;
    const noProject = record.projectEvidence.noRelevantProjectAvailable;
    const analysisAuthorized = consent.analysisAuthorization;

    return (
      <Workspace currentStep={2}>
        <section className="case-state" aria-labelledby="candidate-step-title">
          <p className="eyebrow">Step 2 of 4</p>
          <h2 id="candidate-step-title">Candidate Consent &amp; Evidence</h2>
          <p className="case-label">{record.metadata.demoLabel}</p>

          <div className="context-panel">
            <h3>Context for this authorization</h3>
            <dl className="baseline-summary">
              <div><dt>Authorized recipient</dt><dd>{consent.authorizedRecipient}</dd></div>
              <div><dt>Employer</dt><dd>{consent.employer}</dd></div>
              <div><dt>Role</dt><dd>{consent.role}</dd></div>
              <div><dt>Purpose</dt><dd>{consent.purpose}</dd></div>
              <div><dt>Hiring cycle</dt><dd>{consent.hiringCycle}</dd></div>
              <div><dt>Simulated project</dt><dd>{record.projectEvidence.projectTitle}</dd></div>
              <div><dt>Specific decision</dt><dd>{record.projectEvidence.specificDecision}</dd></div>
            </dl>
          </div>

          {noProject ? (
            <div className="consent-panel" id="free-evidence-route">
              <h3>No relevant project available</h3>
              <p>Not having a relevant project is not evidence of lacking ability.</p>
              <p>No LLM analysis, employer-facing negative signal, or substitution experiment is created.</p>
              <button className="primary-action" type="button" onClick={() => setShowHandoff(true)}>
                Open free evidence-route handoff
              </button>
              {showHandoff && (
                <p className="handoff-message" role="status">
                  Free evidence-route handoff requested. This demo stops here and does not create,
                  recommend, or evaluate replacement evidence.
                </p>
              )}
            </div>
          ) : consent.contextAuthorization === "declined" ? (
            <div className="consent-panel">
              <h3>Do not share</h3>
              <p>No project, confirmation response, or interpretation is available to the employer.</p>
            </div>
          ) : consent.contextAuthorization !== "authorized" ? (
            <div className="consent-panel">
              <h3>Choose how to continue</h3>
              <p>Authorization applies only to the employer, role, purpose, and hiring cycle shown above.</p>
              <div className="action-row">
                <button className="primary-action" type="button" onClick={chooseContextAuthorization}>Share for this context</button>
                <button className="secondary-action" type="button" onClick={chooseDoNotShare}>Do not share</button>
                <button className="secondary-action" type="button" onClick={chooseNoProject}>No relevant project available</button>
              </div>
            </div>
          ) : !analysisAuthorized ? (
            <div className="consent-panel">
              <h3>Text confirmation</h3>
              <p className="fixed-prompt"><strong>Project-specific prompt:</strong> {record.confirmation.prompt}</p>
              {isReviewingResponse ? (
                <div className="response-review">
                  <h4>Review your response</h4>
                  <p>{draftResponse}</p>
                  <div className="action-row">
                    <button className="secondary-action" type="button" onClick={() => setIsReviewingResponse(false)}>Edit response</button>
                    <button className="primary-action" type="button" onClick={authorizeTextAnalysis}>Authorize analysis</button>
                  </div>
                </div>
              ) : (
                <label className="field">
                  <span>Your simulated response</span>
                  <textarea
                    maxLength={600}
                    onChange={(event) => setDraftResponse(event.target.value)}
                    rows={6}
                    value={draftResponse}
                  />
                  <span className="character-count">{draftResponse.length}/600 characters</span>
                  <button
                    className="primary-action align-start"
                    disabled={draftResponse.trim().length === 0}
                    type="button"
                    onClick={() => setIsReviewingResponse(true)}
                  >
                    Review response
                  </button>
                </label>
              )}
              {validationMessage && <p className="validation-message" role="alert">{validationMessage}</p>}
            </div>
          ) : (
            <div className="consent-panel">
              <h3>Analysis unavailable</h3>
              <p>
                This is a temporary Feature 4 technical placeholder. No Gemini request was made and
                no AI evidence conclusion was produced.
              </p>
              {consent.sharingStatus === "paused_pending_review" && (
                <p className="handoff-message" role="status">Sharing is paused pending human review.</p>
              )}
              <div className="action-row">
                <button className="primary-action" disabled type="button" title="A valid interpretation is required before sharing">Share</button>
                <button className="secondary-action" type="button" onClick={pauseForHumanReview}>Request human review</button>
                <button className="secondary-action" type="button" onClick={chooseDoNotShare}>Do not share</button>
              </div>
            </div>
          )}

          <div className="step-actions">
            <button className="secondary-action" type="button" onClick={goToBaselineStep}>Back to Baseline Setup</button>
            <button className="secondary-action" type="button" onClick={deleteCase}>Delete demo case</button>
          </div>
        </section>
      </Workspace>
    );
  }

  return (
    <Workspace currentStep={1}>
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
          <button className="primary-action" type="button" onClick={goToCandidateStep}>
            Continue to Candidate Consent &amp; Evidence
          </button>
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
    </Workspace>
  );
}

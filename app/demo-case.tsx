"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { analysisOutputSchema } from "@/lib/ai/contracts";
import {
  applyAnalysisOutput,
  createAnalysisRequest,
  markAnalysisInProgress,
  markAnalysisUnavailable,
} from "@/lib/demo-record/analysis-state";
import { calculateEmployerCost, lockCheckpoint1, type EmployerCost } from "@/lib/demo-record/checkpoint1";
import {
  authorizeCurrentContext,
  authorizeReviewedTextAnalysis,
  authorizeReviewedVoiceAnalysis,
  declineSharing,
  openEmployerReviewStep,
  openBaselineStep,
  openCandidateStep,
  canEmployerViewEvidence,
  recordHiringManagerReview,
  recordStatedInterest,
  requestHumanReview,
  selectNoRelevantProject,
  shareAuthorizedInterpretation,
} from "@/lib/demo-record/consent";
import { createSimulatedDemoRecord } from "@/lib/demo-record/fixture";
import {
  applyCheckpoint3Facts,
  openFinalOutcomeStep,
} from "@/lib/demo-record/outcome";
import { candidateConsentGuidance } from "@/lib/demo-record/consent-guidance";
import {
  checkpoint1BaselineDraftSchema,
  checkpoint3FactsSchema,
  type Checkpoint1BaselineDraft,
  type CostInputs,
  type HiringCycleRecord,
} from "@/lib/demo-record/schema";
import {
  deleteDemoRecord,
  loadDemoRecord,
  saveDemoRecord,
} from "@/lib/demo-record/storage";
import { VoiceConfirmation } from "./voice-confirmation";

type CostPrefix = "current" | "proposed" | "actual";

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

function actualCostInputsFromForm(formData: FormData): CostInputs {
  return {
    talentAcquisitionMinutesPerCandidate: numberValue(formData, "actualTaMinutes"),
    talentAcquisitionHourlyRateMxn: numberValue(formData, "actualTaRate"),
    hiringManagerMinutesPerCandidate: numberValue(formData, "actualHmMinutes"),
    hiringManagerHourlyRateMxn: numberValue(formData, "actualHmRate"),
    externalFeesPerCandidateMxn: numberValue(formData, "actualExternalFees"),
    llmSystemCostPerCandidateMxn: numberValue(formData, "actualSystemCost"),
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

  async function runAnalysis(authorizedRecord: HiringCycleRecord) {
    const analyzingRecord = markAnalysisInProgress(authorizedRecord);
    persistRecord(analyzingRecord);

    try {
      const response = await fetch("/api/analyze-evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createAnalysisRequest(analyzingRecord)),
      });
      const body: unknown = await response.json();
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("status" in body) ||
        body.status !== "available" ||
        !("interpretation" in body)
      ) {
        throw new Error("ANALYSIS_UNAVAILABLE");
      }
      const output = analysisOutputSchema.parse(body.interpretation);
      persistRecord(applyAnalysisOutput(analyzingRecord, output));
    } catch {
      persistRecord(markAnalysisUnavailable(analyzingRecord));
    }
  }

  async function authorizeTextAnalysis() {
    if (record === null) return;
    try {
      const authorized = authorizeReviewedTextAnalysis(record, draftResponse, isReviewingResponse);
      setValidationMessage(null);
      await runAnalysis(authorized);
    } catch {
      setValidationMessage(
        "Use 1–600 characters of simulated content without an email address or phone number.",
      );
    }
  }

  async function authorizeVoiceAnalysis(transcript: string) {
    if (record === null) return;
    try {
      const authorized = authorizeReviewedVoiceAnalysis(record, transcript, true);
      setValidationMessage(null);
      await runAnalysis(authorized);
    } catch {
      setValidationMessage(
        "Use 1–600 characters of simulated content without an email address or phone number.",
      );
    }
  }

  async function retryAnalysis() {
    if (record !== null && record.confirmation.confirmationResponse !== null) {
      await runAnalysis(record);
    }
  }

  function pauseForHumanReview() {
    if (record !== null) persistRecord(requestHumanReview(record));
  }

  function shareInterpretation() {
    if (record !== null) persistRecord(shareAuthorizedInterpretation(record));
  }

  function continueToEmployerReview() {
    if (record === null) return;
    try {
      persistRecord(openEmployerReviewStep(record));
      setValidationMessage(null);
    } catch {
      setValidationMessage("Candidate authorization is required before employer review.");
    }
  }

  function saveHiringManagerReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (record === null) return;
    const values = new FormData(event.currentTarget);
    const review = values.get("hiringManagerReview");
    const relevance = values.get("hiringManagerRelevance");
    const noteValue = values.get("hiringManagerNote");
    if (
      (review !== "Agree" && review !== "Disagree" && review !== "Needs further review") ||
      (relevance !== "Relevant" && relevance !== "Not relevant" && relevance !== "Needs further review")
    ) {
      setValidationMessage("Choose a permitted Hiring Manager review and relevance value.");
      return;
    }
    try {
      const nextRecord = recordHiringManagerReview(
        record,
        review,
        relevance,
        typeof noteValue === "string" && noteValue.trim().length > 0 ? noteValue : null,
      );
      persistRecord(nextRecord);
      setValidationMessage(null);
    } catch {
      setValidationMessage("Use a Hiring Manager note of 500 characters or fewer.");
    }
  }

  function saveStatedInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (record === null) return;
    const statedInterest = new FormData(event.currentTarget).get("statedInterest");
    if (
      statedInterest !== "Interested in testing the proof workflow" &&
      statedInterest !== "Needs more information" &&
      statedInterest !== "Not interested" &&
      statedInterest !== "Not recorded"
    ) {
      setValidationMessage("Choose a permitted stated-interest value.");
      return;
    }
    try {
      persistRecord(recordStatedInterest(record, statedInterest));
      setValidationMessage(null);
    } catch {
      setValidationMessage("Complete the Hiring Manager review and relevance before recording interest.");
    }
  }

  function continueToFinalOutcome() {
    if (record === null) return;
    try {
      persistRecord(openFinalOutcomeStep(record));
      setValidationMessage(null);
    } catch {
      setValidationMessage("Complete authorized evidence review before final workflow facts.");
    }
  }

  function saveCheckpoint3Facts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (record === null) return;
    const values = new FormData(event.currentTarget);
    const originalStepRemains = values.get("originalStepRemains");
    const equivalentReplacementExists = values.get("equivalentReplacementExists");
    if (
      (originalStepRemains !== "true" && originalStepRemains !== "false") ||
      (equivalentReplacementExists !== "true" && equivalentReplacementExists !== "false")
    ) {
      setValidationMessage("Choose permitted workflow fact values.");
      return;
    }
    try {
      const facts = checkpoint3FactsSchema.parse({
        originalStepRemains: originalStepRemains === "true",
        finalDurationMinutes: numberValue(values, "finalDurationMinutes"),
        finalEmployerActiveTimeMinutesPerCandidate: numberValue(values, "finalEmployerActiveTimeMinutesPerCandidate"),
        equivalentReplacementExists: equivalentReplacementExists === "true",
        finalCandidateVolume: numberValue(values, "finalCandidateVolume"),
        actualWorkflowCostInputs: actualCostInputsFromForm(values),
        effectiveDate: values.get("effectiveDate"),
        approvingRole: values.get("approvingRole"),
        simulatedDocumentType: values.get("simulatedDocumentType"),
        simulatedDocumentReference: values.get("simulatedDocumentReference"),
        changeDescription: values.get("changeDescription"),
      });
      persistRecord(applyCheckpoint3Facts(record, facts));
      setValidationMessage(null);
    } catch {
      setValidationMessage("Complete every required workflow fact and simulated documentation field.");
    }
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

          <div className="consent-panel" role="note" aria-label="Candidate consent guidance">
            <h3>{candidateConsentGuidance.heading}</h3>
            <p>{candidateConsentGuidance.simulation}</p>
            <p>{candidateConsentGuidance.realWorkflow}</p>
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
              <VoiceConfirmation onAuthorize={authorizeVoiceAnalysis} prompt={record.confirmation.prompt} />
              {validationMessage && <p className="validation-message" role="alert">{validationMessage}</p>}
            </div>
          ) : (
            <div className="consent-panel">
              {record.llmInterpretation.analysisStatus === "analyzing" && (
                <><h3>Analyzing simulated evidence</h3><p role="status">Gemini analysis is in progress…</p></>
              )}
              {record.llmInterpretation.analysisStatus === "analysis_unavailable" && (
                <><h3>Analysis unavailable</h3><p>A technical, API, timeout, or response-validation problem prevented an AI conclusion. This is not an evidence or ability judgment.</p></>
              )}
              {record.llmInterpretation.analysisStatus === "available" && (
                <div className="interpretation-result">
                  <h3>{record.llmInterpretation.evidenceStatus}</h3>
                  <p className="data-disclosure">{record.llmInterpretation.modelDisclosure}</p>
                  <h4>Observable evidence</h4>
                  <ul>{record.llmInterpretation.observableEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
                  <h4>Source references</h4>
                  <ul>{record.llmInterpretation.sourceReferences.map((item) => <li key={item}>{item}</li>)}</ul>
                  <h4>Limitations</h4>
                  <ul>{record.llmInterpretation.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
                  {record.calculatedResults.additionalHumanReviewRequired && <p className="handoff-message">Additional human review is required.</p>}
                </div>
              )}
              {consent.sharingStatus === "paused_pending_review" && (
                <p className="handoff-message" role="status">Sharing is paused pending human review.</p>
              )}
              {record.llmInterpretation.analysisStatus !== "analyzing" && (
                <div className="action-row">
                  <button className="primary-action" disabled={record.llmInterpretation.analysisStatus !== "available"} type="button" onClick={shareInterpretation}>Share</button>
                  {record.llmInterpretation.analysisStatus === "analysis_unavailable" && <button className="secondary-action" type="button" onClick={retryAnalysis}>Retry analysis</button>}
                  <button className="secondary-action" type="button" onClick={pauseForHumanReview}>Request human review</button>
                  <button className="secondary-action" type="button" onClick={chooseDoNotShare}>Do not share</button>
                </div>
              )}
              {consent.sharingStatus === "authorized" && <p className="handoff-message" role="status">Candidate-authorized sharing is recorded for this context.</p>}
              {consent.sharingStatus === "authorized" && record.llmInterpretation.analysisStatus === "available" && (
                <button className="primary-action" type="button" onClick={continueToEmployerReview}>
                  Continue to Evidence Review &amp; Interest
                </button>
              )}
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

  if (record.metadata.currentStep === 3) {
    const canReview = canEmployerViewEvidence(record);
    const review = record.hiringManagerReview;
    const interest = record.checkpoint2Response.statedInterest;

    return (
      <Workspace currentStep={3}>
        <section className="case-state" aria-labelledby="employer-review-title">
          <p className="eyebrow">Step 3 of 4</p>
          <h2 id="employer-review-title">Evidence Review &amp; Interest</h2>
          <p className="case-label">{record.metadata.demoLabel}</p>

          <div className="context-panel">
            <h3>Authorized context</h3>
            <dl className="baseline-summary">
              <div><dt>Employer</dt><dd>{record.contextAndConsent.employer}</dd></div>
              <div><dt>Role</dt><dd>{record.contextAndConsent.role}</dd></div>
              <div><dt>Purpose</dt><dd>{record.contextAndConsent.purpose}</dd></div>
              <div><dt>Hiring cycle</dt><dd>{record.contextAndConsent.hiringCycle}</dd></div>
              <div><dt>Specific decision</dt><dd>{record.projectEvidence.specificDecision}</dd></div>
            </dl>
          </div>

          {!canReview ? (
            <div className="consent-panel">
              <h3>Employer evidence unavailable</h3>
              <p>The Candidate has not authorized sharing of a valid interpretation for this context.</p>
              <p>No project, confirmation response, or interpretation is available here.</p>
            </div>
          ) : (
            <>
              <div className="consent-panel interpretation-result">
                <h3>{record.llmInterpretation.evidenceStatus}</h3>
                <p className="data-disclosure">{record.llmInterpretation.modelDisclosure}</p>
                <h4>Authorized project evidence</h4>
                <p>{record.projectEvidence.projectTitle}</p>
                <ul>
                  {record.projectEvidence.sourceExcerpts.map((source) => (
                    <li key={source.sourceId}>
                      <strong>{source.sourceId}:</strong> {source.excerpt}
                    </li>
                  ))}
                </ul>
                <h4>Candidate confirmation</h4>
                <p className="plain-text">{record.confirmation.confirmationResponse}</p>
                <h4>Observable evidence</h4>
                <ul>{record.llmInterpretation.observableEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
                <h4>Source references</h4>
                <ul>{record.llmInterpretation.sourceReferences.map((item) => <li key={item}>{item}</li>)}</ul>
                <h4>Limitations</h4>
                <ul>{record.llmInterpretation.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>

              <form className="consent-panel" onSubmit={saveHiringManagerReview}>
                <h3>Hiring Manager review</h3>
                <p>Review only the authorized project evidence for the specific screening decision shown above.</p>
                <div className="field-grid">
                  <label className="field">
                    <span>Evidence review</span>
                    <select defaultValue={review.review ?? ""} name="hiringManagerReview" required>
                      <option value="" disabled>Select review</option>
                      <option>Agree</option>
                      <option>Disagree</option>
                      <option>Needs further review</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Relevance to this decision</span>
                    <select defaultValue={review.relevance ?? ""} name="hiringManagerRelevance" required>
                      <option value="" disabled>Select relevance</option>
                      <option>Relevant</option>
                      <option>Not relevant</option>
                      <option>Needs further review</option>
                    </select>
                  </label>
                </div>
                <label className="field field-wide">
                  <span>Optional bounded note</span>
                  <textarea defaultValue={review.note ?? ""} maxLength={500} name="hiringManagerNote" rows={4} />
                  <span className="character-count">Maximum 500 characters</span>
                </label>
                <button className="primary-action" type="submit">Save Hiring Manager review</button>
                {review.review !== null && review.relevance !== null && (
                  <p className="handoff-message" role="status">Hiring Manager review and relevance are recorded separately.</p>
                )}
              </form>

              <form className="consent-panel" onSubmit={saveStatedInterest}>
                <h3>Stated employer interest</h3>
                <p>Interest is intention only. It does not establish adoption, acceptance, substitution, or economic validation.</p>
                <label className="field">
                  <span>Talent Acquisition Manager response</span>
                  <select defaultValue={interest} name="statedInterest" disabled={review.review === null || review.relevance === null}>
                    <option>Not recorded</option>
                    <option>Interested in testing the proof workflow</option>
                    <option>Needs more information</option>
                    <option>Not interested</option>
                  </select>
                </label>
                <button className="primary-action" disabled={review.review === null || review.relevance === null} type="submit">
                  Save stated interest
                </button>
                {interest !== "Not recorded" && <p className="handoff-message" role="status">Stated interest is recorded separately from evidence and review.</p>}
              </form>
            </>
          )}

          {validationMessage && <p className="validation-message" role="alert">{validationMessage}</p>}
          <div className="step-actions">
            <button className="secondary-action" type="button" onClick={() => persistRecord(openCandidateStep(record))}>Back to Candidate Consent &amp; Evidence</button>
            {review.review !== null && review.relevance !== null && (
              <button className="primary-action" type="button" onClick={continueToFinalOutcome}>
                Continue to Final Workflow Outcome
              </button>
            )}
            <button className="secondary-action" type="button" onClick={deleteCase}>Delete demo case</button>
          </div>
        </section>
      </Workspace>
    );
  }

  if (record.metadata.currentStep === 4) {
    const facts = record.checkpoint3Facts;
    const currentInputs = baseline.currentScreeningCostInputs;
    const proposedInputs = baseline.proposedProofWorkflowCostInputs;
    const defaultActualInputs = facts.actualWorkflowCostInputs ?? {
      talentAcquisitionMinutesPerCandidate:
        currentInputs.talentAcquisitionMinutesPerCandidate + proposedInputs.talentAcquisitionMinutesPerCandidate,
      talentAcquisitionHourlyRateMxn: currentInputs.talentAcquisitionHourlyRateMxn,
      hiringManagerMinutesPerCandidate:
        currentInputs.hiringManagerMinutesPerCandidate + proposedInputs.hiringManagerMinutesPerCandidate,
      hiringManagerHourlyRateMxn: currentInputs.hiringManagerHourlyRateMxn,
      externalFeesPerCandidateMxn:
        currentInputs.externalFeesPerCandidateMxn + proposedInputs.externalFeesPerCandidateMxn,
      llmSystemCostPerCandidateMxn:
        currentInputs.llmSystemCostPerCandidateMxn + proposedInputs.llmSystemCostPerCandidateMxn,
    };
    const result = record.calculatedResults;

    return (
      <Workspace currentStep={4}>
        <section className="case-state" aria-labelledby="outcome-title">
          <p className="eyebrow">Step 4 of 4</p>
          <h2 id="outcome-title">Final Workflow Outcome</h2>
          <p className="case-label">{record.metadata.demoLabel}</p>
          <p className="placeholder-copy">
            Enter documented simulated workflow facts. The result is calculated from these facts and cannot be selected directly.
          </p>

          <form className="consent-panel" onSubmit={saveCheckpoint3Facts}>
            <h3>Checkpoint 3 — documented workflow facts</h3>
            <div className="field-grid">
              <label className="field">
                <span>Original screening step remains required</span>
                <select defaultValue={facts.originalStepRemains === null ? "" : String(facts.originalStepRemains)} name="originalStepRemains" required>
                  <option value="" disabled>Select documented fact</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="field">
                <span>Equivalent replacement screen exists</span>
                <select defaultValue={facts.equivalentReplacementExists === null ? "" : String(facts.equivalentReplacementExists)} name="equivalentReplacementExists" required>
                  <option value="" disabled>Select documented fact</option>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <NumberField defaultValue={facts.finalDurationMinutes ?? baseline.originalDurationMinutes} label="Final duration (minutes)" min={0} name="finalDurationMinutes" />
              <NumberField defaultValue={facts.finalEmployerActiveTimeMinutesPerCandidate ?? baseline.employerActiveTimeMinutesPerCandidate} label="Final employer active time per candidate (minutes)" min={0} name="finalEmployerActiveTimeMinutesPerCandidate" />
              <NumberField defaultValue={facts.finalCandidateVolume ?? baseline.candidateVolume} label="Final candidate volume" min={1} name="finalCandidateVolume" step={1} />
              <label className="field">
                <span>Effective date</span>
                <input defaultValue={facts.effectiveDate ?? ""} name="effectiveDate" required type="date" />
              </label>
            </div>
            <CostFields heading="Actual final workflow cost inputs" inputs={defaultActualInputs} prefix="actual" />
            <div className="field-grid">
              <label className="field"><span>Approving role</span><input defaultValue={facts.approvingRole ?? ""} maxLength={120} name="approvingRole" required /></label>
              <label className="field"><span>Simulated document type</span><input defaultValue={facts.simulatedDocumentType ?? ""} maxLength={120} name="simulatedDocumentType" required /></label>
              <label className="field"><span>Simulated document reference</span><input defaultValue={facts.simulatedDocumentReference ?? ""} maxLength={120} name="simulatedDocumentReference" required /></label>
            </div>
            <label className="field field-wide"><span>Bounded change description</span><textarea defaultValue={facts.changeDescription ?? ""} maxLength={500} name="changeDescription" required rows={4} /></label>
            <button className="primary-action" type="submit">Calculate documented outcome</button>
          </form>

          <div className="result-grid" aria-label="Separate final workflow results">
            <div className="result-card"><h3>Evidence status</h3><p>{record.llmInterpretation.evidenceStatus ?? "Not available"}</p></div>
            <div className="result-card"><h3>Stated employer interest</h3><p>{record.checkpoint2Response.statedInterest}</p></div>
            <div className="result-card"><h3>Observed workflow outcome</h3><p>{result.outcome ?? "Complete documented facts"}</p><p className="result-detail">Observed substitution: {result.observedSubstitution ?? "Pending documented facts"}</p></div>
            <div className="result-card"><h3>Cross-employer validation</h3><p>{result.crossEmployerValidation}</p></div>
          </div>

          <div className="consent-panel">
            <h3>Employer-side cost comparison</h3>
            {result.currentCost && result.proposedCost && <div className="cost-comparison"><CostSummary label="Current screening cost" cost={result.currentCost} /><CostSummary label="Proposed Proof-workflow cost" cost={result.proposedCost} /></div>}
            {result.actualCost && <div className="cost-comparison"><CostSummary label="Actual final workflow cost" cost={result.actualCost} /></div>}
            {result.normalizedBaselineAtFinalVolumeMxn !== null && <p className="candidate-time-note">Normalized locked baseline at final volume: {formatMxn(result.normalizedBaselineAtFinalVolumeMxn)} total.</p>}
            <p className="candidate-time-note">Candidate time is tracked separately and is not included in employer cost.</p>
            <p className="data-disclosure">These are simulated workflow calculations. They do not establish ROI, savings, causality, acceptance, adoption, or economic value.</p>
          </div>

          {validationMessage && <p className="validation-message" role="alert">{validationMessage}</p>}
          <div className="step-actions">
            <button className="secondary-action" type="button" onClick={() => persistRecord(openEmployerReviewStep(record))}>Back to Evidence Review &amp; Interest</button>
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

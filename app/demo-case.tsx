"use client";

import { useEffect, useState } from "react";

import { createSimulatedDemoRecord } from "@/lib/demo-record/fixture";
import type { HiringCycleRecord } from "@/lib/demo-record/schema";
import {
  deleteDemoRecord,
  loadDemoRecord,
  saveDemoRecord,
} from "@/lib/demo-record/storage";

export function DemoCase() {
  const [record, setRecord] = useState<HiringCycleRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => {
      setRecord(loadDemoRecord(window.localStorage));
      setIsLoaded(true);
    });

    return () => window.cancelAnimationFrame(hydrationFrame);
  }, []);

  function createCase() {
    const nextRecord = createSimulatedDemoRecord();
    saveDemoRecord(window.localStorage, nextRecord);
    setRecord(nextRecord);
  }

  function deleteCase() {
    deleteDemoRecord(window.localStorage);
    setRecord(null);
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
      <p className="placeholder-copy">
        The simulated record is ready. Baseline controls and calculations are not part of this
        feature.
      </p>
      <button className="secondary-action" type="button" onClick={deleteCase}>
        Delete demo case
      </button>
    </section>
  );
}

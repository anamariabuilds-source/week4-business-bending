const workflowSteps = [
  "Baseline Setup",
  "Candidate Consent & Evidence",
  "Evidence Review & Interest",
  "Final Workflow Outcome",
] as const;

export default function Home() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <p className="demo-banner">SIMULATED DEMO DATA</p>
        <h1>Screening Substitution Tracker</h1>
      </header>

      <div className="workspace">
        <nav className="step-navigation" aria-label="Workflow steps">
          <ol>
            {workflowSteps.map((step, index) => (
              <li key={step} aria-current={index === 0 ? "step" : undefined}>
                <span className="step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </nav>

        <main className="main-content">
          <p className="eyebrow">Step 1 of 4</p>
          <h2>Baseline Setup</h2>
          <p className="placeholder-copy">
            This foundation establishes the four-step demo workspace. Baseline controls will be
            added in a later feature.
          </p>
        </main>
      </div>
    </div>
  );
}

import { DemoCase } from "./demo-case";

export default function Home() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <p className="demo-banner">SIMULATED DEMO DATA</p>
        <h1>Screening Substitution Tracker</h1>
      </header>

      <DemoCase />
    </div>
  );
}

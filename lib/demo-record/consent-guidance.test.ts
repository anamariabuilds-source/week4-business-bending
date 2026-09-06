import { describe, expect, it } from "vitest";

import { candidateConsentGuidance } from "./consent-guidance";

describe("candidate consent guidance", () => {
  it("makes the candidate actor and simulated operator explicit", () => {
    expect(candidateConsentGuidance.heading).toBe("Candidate decision");
    expect(candidateConsentGuidance.simulation).toContain("belongs to the candidate");
    expect(candidateConsentGuidance.simulation).toContain("simulating the candidate's choice");
    expect(candidateConsentGuidance.realWorkflow).toContain("must not provide consent");
    expect(candidateConsentGuidance.realWorkflow).toContain("candidate's behalf");
  });
});

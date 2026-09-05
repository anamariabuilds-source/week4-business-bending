import { describe, expect, it, vi } from "vitest";

import { MAX_AUDIO_BYTES } from "../ai/contracts";
import { MAX_RECORDING_MS, releaseObjectUrl, shouldAutomaticallyStop, validateRecordedAudio } from "./state";

describe("Voice client limits and cleanup", () => {
  it("automatically stops at the 60-second boundary", () => {
    expect(shouldAutomaticallyStop(MAX_RECORDING_MS - 1)).toBe(false);
    expect(shouldAutomaticallyStop(MAX_RECORDING_MS)).toBe(true);
    expect(shouldAutomaticallyStop(MAX_RECORDING_MS + 1)).toBe(true);
  });

  it("validates supported temporary audio under the 5 MB limit", () => {
    expect(validateRecordedAudio(new Blob([new Uint8Array(100)], { type: "audio/webm" }))).toBe("valid");
  });

  it("rejects empty, oversized, and unsupported temporary audio", () => {
    expect(validateRecordedAudio(new Blob([], { type: "audio/webm" }))).toBe("empty");
    expect(
      validateRecordedAudio(new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: "audio/webm" })),
    ).toBe("too_large");
    expect(validateRecordedAudio(new Blob(["audio"], { type: "audio/wav" }))).toBe("unsupported_type");
  });

  it("revokes an object URL during cleanup", () => {
    const revoke = vi.fn();
    expect(releaseObjectUrl("blob:temporary-demo", revoke)).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:temporary-demo");
  });
});

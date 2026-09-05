import { allowedAudioMimeTypes, MAX_AUDIO_BYTES } from "../ai/contracts";

export const MAX_RECORDING_MS = 60_000;

export type VoiceStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "recorded"
  | "transcribing"
  | "transcript_ready"
  | "unavailable";

export function shouldAutomaticallyStop(elapsedMs: number): boolean {
  return elapsedMs >= MAX_RECORDING_MS;
}

export function validateRecordedAudio(blob: Blob): "valid" | "unsupported_type" | "too_large" | "empty" {
  const mimeType = blob.type.split(";", 1)[0].toLowerCase();
  if (!allowedAudioMimeTypes.includes(mimeType as (typeof allowedAudioMimeTypes)[number])) {
    return "unsupported_type";
  }
  if (blob.size === 0) return "empty";
  if (blob.size > MAX_AUDIO_BYTES) return "too_large";
  return "valid";
}

export function releaseObjectUrl(url: string | null, revoke: (url: string) => void): null {
  if (url !== null) revoke(url);
  return null;
}

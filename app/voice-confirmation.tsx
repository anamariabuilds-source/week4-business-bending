"use client";

import { useEffect, useRef, useState } from "react";

import { allowedAudioMimeTypes, MAX_AUDIO_BYTES } from "@/lib/ai/contracts";
import {
  MAX_RECORDING_MS,
  releaseObjectUrl,
  shouldAutomaticallyStop,
  validateRecordedAudio,
  type VoiceStatus,
} from "@/lib/voice/state";

type VoiceConfirmationProps = {
  onAuthorize: (transcript: string) => void;
  prompt: string;
};

export function VoiceConfirmation({ onAuthorize, prompt }: VoiceConfirmationProps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const oversizedRef = useRef(false);
  const canceledRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearTimers() {
    if (stopTimerRef.current !== null) clearTimeout(stopTimerRef.current);
    if (elapsedTimerRef.current !== null) clearInterval(elapsedTimerRef.current);
    stopTimerRef.current = null;
    elapsedTimerRef.current = null;
  }

  function clearTemporaryAudio() {
    setAudioBlob(null);
    setObjectUrl((currentUrl) => releaseObjectUrl(currentUrl, URL.revokeObjectURL));
    chunksRef.current = [];
    bytesRef.current = 0;
    oversizedRef.current = false;
  }

  useEffect(() => {
    return () => {
      clearTimers();
      stopTracks();
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  async function startRecording() {
    clearTemporaryAudio();
    setTranscript("");
    setElapsedSeconds(0);
    setStatus("requesting_permission");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("VOICE_UNAVAILABLE");
      }
      const mimeType = allowedAudioMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("VOICE_FORMAT_UNAVAILABLE");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      bytesRef.current = 0;
      oversizedRef.current = false;
      canceledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        chunksRef.current.push(event.data);
        bytesRef.current += event.data.size;
        if (bytesRef.current > MAX_AUDIO_BYTES) {
          oversizedRef.current = true;
          if (recorder.state === "recording") recorder.stop();
        }
      };
      recorder.onstop = () => {
        clearTimers();
        stopTracks();
        if (canceledRef.current) {
          clearTemporaryAudio();
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (oversizedRef.current || validateRecordedAudio(blob) !== "valid") {
          clearTemporaryAudio();
          setStatus("unavailable");
          return;
        }
        setAudioBlob(blob);
        setObjectUrl(URL.createObjectURL(blob));
        setStatus("recorded");
      };
      recorder.onerror = () => {
        clearTimers();
        stopTracks();
        clearTemporaryAudio();
        setStatus("unavailable");
      };
      recorder.start(250);
      setStatus("recording");

      const startedAt = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setElapsedSeconds(Math.min(60, Math.floor(elapsed / 1000)));
        if (shouldAutomaticallyStop(elapsed) && recorder.state === "recording") recorder.stop();
      }, 250);
      stopTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch {
      clearTimers();
      stopTracks();
      clearTemporaryAudio();
      setStatus("unavailable");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function cancelRecording() {
    canceledRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    clearTimers();
    stopTracks();
    clearTemporaryAudio();
    setTranscript("");
    setStatus("idle");
  }

  async function transcribe() {
    if (audioBlob === null || validateRecordedAudio(audioBlob) !== "valid") {
      setStatus("unavailable");
      return;
    }
    setStatus("transcribing");
    try {
      const response = await fetch("/api/transcribe-confirmation", {
        method: "POST",
        headers: { "content-type": audioBlob.type.split(";", 1)[0] },
        body: audioBlob,
      });
      const body: unknown = await response.json();
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("status" in body) ||
        body.status !== "available" ||
        !("transcript" in body) ||
        typeof body.transcript !== "string"
      ) {
        throw new Error("TRANSCRIPTION_UNAVAILABLE");
      }
      setTranscript(body.transcript.slice(0, 600));
      setStatus("transcript_ready");
    } catch {
      setStatus("unavailable");
    } finally {
      clearTemporaryAudio();
    }
  }

  return (
    <section className="voice-panel" aria-labelledby="voice-heading">
      <h4 id="voice-heading">Voice confirmation</h4>
      <p><strong>Same project-specific prompt:</strong> {prompt}</p>
      <p className="data-disclosure">
        This demo does not persist audio. Audio is sent to Gemini for transcription and is handled
        under Google Free Tier terms. Use simulated content only.
      </p>
      <p>Voice is for transcription only. It does not verify identity, authorship, or evidence.</p>

      {(status === "idle" || status === "unavailable") && (
        <button className="secondary-action" type="button" onClick={startRecording}>
          {status === "unavailable" ? "Try Voice again" : "Authorize microphone and record"}
        </button>
      )}
      {status === "requesting_permission" && <p role="status">Requesting microphone permission…</p>}
      {status === "recording" && (
        <div>
          <p role="status">Recording: {elapsedSeconds} of 60 seconds</p>
          <div className="action-row">
            <button className="secondary-action" type="button" onClick={stopRecording}>Stop recording</button>
            <button className="secondary-action" type="button" onClick={cancelRecording}>Cancel</button>
          </div>
        </div>
      )}
      {status === "recorded" && objectUrl && (
        <div>
          <audio controls src={objectUrl}>Audio playback is unavailable in this browser.</audio>
          <div className="action-row">
            <button className="primary-action" type="button" onClick={transcribe}>Transcribe Voice</button>
            <button className="secondary-action" type="button" onClick={startRecording}>Re-record</button>
            <button className="secondary-action" type="button" onClick={cancelRecording}>Cancel</button>
          </div>
        </div>
      )}
      {status === "transcribing" && <p role="status">Transcribing temporary audio…</p>}
      {status === "transcript_ready" && (
        <label className="field">
          <span>Review and edit transcript</span>
          <textarea maxLength={600} onChange={(event) => setTranscript(event.target.value)} rows={6} value={transcript} />
          <span className="character-count">{transcript.length}/600 characters</span>
          <button
            className="primary-action align-start"
            disabled={transcript.trim().length === 0}
            type="button"
            onClick={() => onAuthorize(transcript)}
          >
            Authorize analysis with reviewed transcript
          </button>
        </label>
      )}
      {status === "unavailable" && (
        <p className="validation-message" role="alert">
          Voice transcription unavailable. Use the Text option, which remains available.
        </p>
      )}
    </section>
  );
}

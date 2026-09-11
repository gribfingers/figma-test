import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AttachIcon, MicIcon } from "../components/Icon";

/**
 * Standalone, unauthenticated demo of the whisper.cpp voice-input backing the Messenger — a
 * separate page (no login, no app chrome) so it can be shown/shared on its own. Talks straight to
 * POST /api/transcribe-demo (see backend/src/index.ts), the same handler as the authenticated
 * Messenger route, just mounted without requireAuth.
 */

const MAX_RECORDING_MS = 120_000;
// Base64 adds ~33% and the whole thing rides in a JSON body the backend caps at 8MB (see
// backend/src/index.ts) — 5MB raw stays comfortably under that with room for the JSON wrapper.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// whisper-server's /inference is one blocking request with no progress events of its own, so this
// bar is an ESTIMATE, not real progress: assume the "small" model transcribes roughly at real time
// on this server, animate toward that over the clip's own duration, and cap short of 100% until the
// real response lands (which may arrive earlier or later than the guess).
const ESTIMATE_RATIO = 1;
const MIN_ESTIMATE_MS = 3000;
const DEFAULT_ESTIMATE_MS = 8000;
const PROGRESS_CAP = 95;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Reads a file's own encoded duration via a throwaway <audio> element — used for uploads, where
 *  (unlike a live recording) there's no wall-clock start/stop to measure instead. */
function getAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    const done = (seconds: number | null) => {
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    audio.onloadedmetadata = () => done(isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

function estimateDurationMs(durationSec: number | null): number {
  if (!durationSec || !isFinite(durationSec)) return DEFAULT_ESTIMATE_MS;
  return Math.max(MIN_ESTIMATE_MS, durationSec * ESTIMATE_RATIO * 1000);
}

export function TranscribeDemo() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "DCS — Распознавание речи";
    return () => {
      recorderRef.current?.stop();
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function startProgress(estimateMs: number) {
    const startedAt = Date.now();
    setProgress(0);
    setRemainingSec(Math.ceil(estimateMs / 1000));
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(PROGRESS_CAP, (elapsed / estimateMs) * 100));
      // The estimate can undershoot the real time (it's a guess) — once elapsed passes it, this
      // just holds at 0 rather than going negative, since we genuinely don't know how much is left.
      setRemainingSec(Math.max(0, Math.ceil((estimateMs - elapsed) / 1000)));
    }, 150);
  }

  function stopProgress(finishedOk: boolean) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(finishedOk ? 100 : 0);
  }

  async function sendForTranscription(dataUrl: string, durationSec: number | null) {
    setError(null);
    setTranscribing(true);
    startProgress(estimateDurationMs(durationSec));
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/transcribe-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: dataUrl }),
        signal: controller.signal,
      });
      // A body over the server's own JSON size limit comes back as a plain-text/HTML error page,
      // not JSON — res.json() would throw on that, so this falls back to a status-based message.
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) throw new Error(body?.error || `Сервер ответил ${res.status}${res.status === 413 ? " — файл слишком большой" : ""}`);
      setText((prev) => (body.text ? (prev.trim() ? `${prev.trim()} ${body.text}` : body.text) : prev));
      if (!body.text) setError("Не удалось распознать речь в записи — попробуйте ещё раз.");
      stopProgress(true);
    } catch (err) {
      // A user-initiated cancel throws AbortError — that's not a failure worth an error box, the
      // person just changed their mind, so it resets quietly instead.
      if (err instanceof DOMException && err.name === "AbortError") {
        stopProgress(false);
      } else {
        setError(err instanceof Error ? err.message : "Не удалось выполнить распознавание.");
        stopProgress(false);
      }
    } finally {
      abortRef.current = null;
      setTranscribing(false);
    }
  }

  function cancelTranscription() {
    abortRef.current?.abort();
  }

  async function startRecording() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setError("Не удалось получить доступ к микрофону.");
      return;
    }
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      const durationSec = (Date.now() - recordingStartedAtRef.current) / 1000;
      recorderRef.current = null;
      setRecording(false);
      if (chunks.length === 0) return;
      const dataUrl = await blobToDataUrl(new Blob(chunks, { type: recorder.mimeType }));
      await sendForTranscription(dataUrl, durationSec);
    };
    recorderRef.current = recorder;
    recordingStartedAtRef.current = Date.now();
    recorder.start();
    setRecording(true);
    setError(null);
    recordingTimeoutRef.current = setTimeout(() => recorderRef.current?.stop(), MAX_RECORDING_MS);
  }

  function toggleRecording() {
    if (recording) recorderRef.current?.stop();
    else startRecording();
  }

  async function onFilePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ) — максимум ${MAX_FILE_BYTES / 1024 / 1024} МБ.`);
      return;
    }
    setError(null);
    const [dataUrl, durationSec] = await Promise.all([blobToDataUrl(file), getAudioDuration(file)]);
    await sendForTranscription(dataUrl, durationSec);
  }

  return (
    <div className="transcribe-demo-page">
      <h1>Распознавание речи</h1>
      <p className="transcribe-demo-intro">
        Демонстрация голосового ввода на базе локального whisper.cpp: говорите в микрофон (до 2 минут за раз) или
        загрузите звуковой файл (до {MAX_FILE_BYTES / 1024 / 1024} МБ) — текст появится ниже.
      </p>

      <div className="transcribe-demo-controls">
        <button type="button" className={recording ? "danger" : ""} disabled={transcribing} onClick={toggleRecording}>
          <MicIcon size={18} />
          {recording ? "Остановить запись" : "Записать голос"}
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={onFilePick} />
        <button type="button" className="secondary" disabled={recording || transcribing} onClick={() => fileInputRef.current?.click()}>
          <AttachIcon size={18} />
          Загрузить файл
        </button>
      </div>

      {recording && <div className="transcribe-demo-status recording">● Идёт запись…</div>}
      {transcribing && (
        <div className="transcribe-demo-status">
          <div className="transcribe-demo-status-row">
            <span>Распознаю…{remainingSec > 0 ? ` осталось примерно ${remainingSec} с` : ""}</span>
            <button type="button" className="tertiary" onClick={cancelTranscription}>
              Отменить
            </button>
          </div>
          <div className="transcribe-demo-progress">
            <div className="transcribe-demo-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {error && <div className="error-box">{error}</div>}

      <textarea
        className="transcribe-demo-result"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Здесь появится распознанный текст…"
        rows={10}
      />
    </div>
  );
}

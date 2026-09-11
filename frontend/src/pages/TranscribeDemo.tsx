import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AttachIcon, MicIcon } from "../components/Icon";

/**
 * Standalone, unauthenticated demo of the whisper.cpp voice-input backing the Messenger — a
 * separate page (no login, no app chrome) so it can be shown/shared on its own. Talks straight to
 * POST /api/transcribe-demo (see backend/src/index.ts), the same handler as the authenticated
 * Messenger route, just mounted without requireAuth.
 */

const MAX_RECORDING_MS = 120_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function TranscribeDemo() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "DCS — Распознавание речи";
    return () => {
      recorderRef.current?.stop();
    };
  }, []);

  async function sendForTranscription(dataUrl: string) {
    setError(null);
    setTranscribing(true);
    try {
      const res = await fetch("/api/transcribe-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: dataUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `Сервер ответил ${res.status}`);
      setText((prev) => (body.text ? (prev.trim() ? `${prev.trim()} ${body.text}` : body.text) : prev));
      if (!body.text) setError("Не удалось распознать речь в записи — попробуйте ещё раз.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить распознавание.");
    } finally {
      setTranscribing(false);
    }
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
      recorderRef.current = null;
      setRecording(false);
      if (chunks.length === 0) return;
      const dataUrl = await blobToDataUrl(new Blob(chunks, { type: recorder.mimeType }));
      await sendForTranscription(dataUrl);
    };
    recorderRef.current = recorder;
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
    const dataUrl = await blobToDataUrl(file);
    await sendForTranscription(dataUrl);
  }

  return (
    <div className="transcribe-demo-page">
      <h1>Распознавание речи</h1>
      <p className="transcribe-demo-intro">
        Демонстрация голосового ввода на базе локального whisper.cpp: говорите в микрофон или загрузите звуковой файл —
        текст появится ниже.
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
      {transcribing && <div className="transcribe-demo-status">Распознаю…</div>}
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

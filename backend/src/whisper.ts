import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import os from "os";
import path from "path";

/**
 * Speech-to-text for the Messenger's voice input, backed by a local
 * whisper.cpp `whisper-server` process (see scripts/setup-whisper.sh — it's
 * a build step, not an npm dependency, so the binary/model may simply not
 * exist yet on a given checkout). Everything here degrades to
 * `isAvailable() === false` rather than throwing when that's the case, so
 * the rest of the app works fine without voice input configured.
 */

const VENDOR_DIR = path.join(__dirname, "..", "vendor", "whisper.cpp");
const SERVER_BIN = path.join(VENDOR_DIR, "build", "bin", "whisper-server");
const MODEL_PATH = path.join(VENDOR_DIR, "models", `ggml-${process.env.WHISPER_MODEL ?? "small"}.bin`);
const HOST = "127.0.0.1";
const PORT = Number(process.env.WHISPER_PORT ?? 8088);

let serverProcess: ChildProcess | null = null;
let warnedMissing = false;

export function isAvailable(): boolean {
  return existsSync(SERVER_BIN) && existsSync(MODEL_PATH);
}

/** Starts the local transcription server as a background child process. Safe to call even when the binary/model aren't present — logs once and no-ops. */
export function startWhisperServer() {
  if (!isAvailable()) {
    if (!warnedMissing) {
      const missing = [!existsSync(SERVER_BIN) && `binary (${SERVER_BIN})`, !existsSync(MODEL_PATH) && `model (${MODEL_PATH})`]
        .filter(Boolean)
        .join(", ");
      console.log(
        `Voice input disabled: whisper.cpp isn't built — missing ${missing}. Run \`backend/scripts/setup-whisper.sh\` (or rebuild the Docker image) and restart the backend to enable it.`
      );
      warnedMissing = true;
    }
    return;
  }
  if (serverProcess) return;

  // whisper-server logs its own request/model lines to stderr even on success, so this is only
  // kept for the exit handler below to print if the process dies unexpectedly — not mirrored to
  // the backend's own log on every line, which would just be noise.
  let recentStderr = "";
  // whisper-server's own default is 4 threads regardless of what the host actually has — on a
  // multi-core deploy box that leaves most of it idle and transcription slower than it needs to be.
  const threads = String(Math.max(1, os.cpus().length));
  serverProcess = spawn(
    SERVER_BIN,
    ["-m", MODEL_PATH, "--host", HOST, "--port", String(PORT), "-t", threads, "-l", "auto", "--convert", "-nt"],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    recentStderr = (recentStderr + chunk.toString()).slice(-4000);
  });
  serverProcess.on("exit", (code) => {
    console.log(`whisper-server exited (code ${code}) — voice input unavailable until the backend restarts.`);
    if (recentStderr.trim()) console.log(`whisper-server's last output:\n${recentStderr}`);
    serverProcess = null;
  });
  console.log(`whisper-server starting on :${PORT} (model: ${path.basename(MODEL_PATH)})`);

  // Confirm it actually came up rather than just trusting the process didn't immediately exit.
  // Loading a large model (e.g. "medium") into memory can take well over the few seconds a small
  // one needs, so this polls for up to a minute instead of judging it on one fixed-delay check.
  void probeHealth();
}

async function probeHealth(attemptsLeft = 30) {
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const res = await fetch(`http://${HOST}:${PORT}/health`);
    if (res.ok) return console.log("whisper-server is up and healthy.");
    console.log(`whisper-server health check returned ${res.status}.`);
  } catch (err) {
    if (attemptsLeft > 1 && serverProcess) return probeHealth(attemptsLeft - 1);
    console.log(`whisper-server health check failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Sends the recorded clip straight to whisper-server, which transcodes it
 * itself (`--convert`, via ffmpeg) — so any format MediaRecorder produces
 * (webm/opus, ogg, …) works without us doing our own conversion.
 *
 * Language is left as "auto": the UI's language toggle is the interface language, not necessarily
 * what the agent is actually speaking, and forcing the wrong one makes whisper translate into that
 * language instead of transcribing what was said — worse than just auto-detecting per clip.
 */
export async function transcribe(audio: Buffer, mimeType: string): Promise<string> {
  const form = new FormData();
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
  form.append("file", new Blob([audio], { type: mimeType }), `voice.${ext}`);
  form.append("response_format", "json");

  const res = await fetch(`http://${HOST}:${PORT}/inference`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`whisper-server responded ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

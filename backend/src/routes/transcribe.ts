import { Router } from "express";
import { isAvailable, transcribe } from "../whisper";

export const transcribeRouter = Router();

/**
 * Parses a `data:<mime>;base64,AAAA...` URL — same convention the app already uses for image
 * uploads (see messages.ts). The mime type itself can carry its own `;`-separated parameters (a
 * browser's recorded clip is typically `audio/webm;codecs=opus`), so the match has to stop at the
 * literal `;base64,` marker rather than the first semicolon.
 */
function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:(.+?);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

transcribeRouter.post("/", async (req, res) => {
  if (!isAvailable()) {
    return res.status(503).json({
      error: "Voice input isn't set up on this server yet. Run backend/scripts/setup-whisper.sh and restart the backend.",
    });
  }
  const { audio } = req.body ?? {};
  const parsed = typeof audio === "string" ? parseDataUrl(audio) : null;
  if (!parsed) return res.status(400).json({ error: "Missing or invalid audio data" });

  try {
    const text = await transcribe(parsed.buffer, parsed.mimeType);
    res.json({ text });
  } catch (err) {
    console.error("Transcription failed:", err);
    res.status(502).json({ error: "Transcription failed" });
  }
});

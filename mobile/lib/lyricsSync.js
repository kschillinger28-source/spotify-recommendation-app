import { LYRIC_LINE_FADE_IN_MS, LYRIC_LINE_FADE_OUT_MS } from "./config";

export function normalizeLyricsText(rawText) {
  return String(rawText ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTimedLyricLines(rawLines) {
  const list = Array.isArray(rawLines) ? rawLines : [];
  return list
    .map((line) => {
      const startMs = Number.isFinite(line?.startMs)
        ? line.startMs
        : Number.isFinite(line?.time)
          ? Math.round(Number(line.time) * 1000)
          : Number.isFinite(line?.timeSeconds)
            ? Math.round(Number(line.timeSeconds) * 1000)
            : null;
      const text = String(line?.text ?? "").trim();
      if (!Number.isFinite(startMs) || !text) {
        return null;
      }
      return { startMs, text };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMs - b.startMs);
}

export function buildLyricChunks(lyricsText) {
  const words = normalizeLyricsText(lyricsText).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const chunkSize = words.length > 240 ? 5 : 4;
  const chunks = [];
  for (let i = 0; i < words.length && chunks.length < 160; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

export function buildEstimatedTimedLinesFromChunks(chunks, durationMs) {
  const n = chunks.length;
  if (n === 0 || !Number.isFinite(durationMs) || durationMs <= 0) {
    return [];
  }
  const slice = durationMs / n;
  return chunks.map((text, index) => ({
    startMs: Math.round(index * slice),
    text
  }));
}

export function findLyricDisplayIndex(lines, progressMs, fadeInMs = LYRIC_LINE_FADE_IN_MS) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return -1;
  }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    const next = lines[i + 1];
    const activeFrom = line.startMs - fadeInMs;
    const activeUntil = next ? next.startMs : Infinity;
    if (progressMs >= activeFrom && progressMs < activeUntil) {
      return i;
    }
  }
  return -1;
}

export function computeLyricLineOpacity(
  progressMs,
  lineStartMs,
  lineEndMs,
  fadeInMs = LYRIC_LINE_FADE_IN_MS,
  fadeOutMs = LYRIC_LINE_FADE_OUT_MS
) {
  const segmentDuration = Math.max(1, lineEndMs - lineStartMs);
  let effectiveFadeIn = Math.min(fadeInMs, segmentDuration * 0.55);
  let effectiveFadeOut = Math.min(fadeOutMs, segmentDuration * 0.5);
  if (effectiveFadeIn + effectiveFadeOut > segmentDuration) {
    const scale = segmentDuration / (effectiveFadeIn + effectiveFadeOut);
    effectiveFadeIn *= scale;
    effectiveFadeOut *= scale;
  }

  const fadeInStart = lineStartMs - effectiveFadeIn;
  const fadeOutStart = lineEndMs - effectiveFadeOut;

  if (progressMs < fadeInStart) {
    return 0;
  }
  if (progressMs < lineStartMs) {
    return (progressMs - fadeInStart) / Math.max(1, effectiveFadeIn);
  }
  if (progressMs < fadeOutStart) {
    return 1;
  }
  if (progressMs < lineEndMs) {
    return 1 - (progressMs - fadeOutStart) / Math.max(1, effectiveFadeOut);
  }
  return 0;
}

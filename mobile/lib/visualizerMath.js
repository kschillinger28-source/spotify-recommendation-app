export function hashStringToInt(value) {
  const text = String(value ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sampleBandValue(values, bandIndex, barCount) {
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) {
    return 0;
  }
  const ratio = barCount > 1 ? bandIndex / (barCount - 1) : 0;
  const position = ratio * (list.length - 1);
  const lowIndex = Math.floor(position);
  const highIndex = Math.min(list.length - 1, lowIndex + 1);
  const frac = position - lowIndex;
  const low = Number(list[lowIndex]) || 0;
  const high = Number(list[highIndex]) || 0;
  return low + (high - low) * frac;
}

export function findSpectrumSegmentForProgress(segments, progressMs, hintIndex = 0) {
  const list = Array.isArray(segments) ? segments : [];
  if (list.length === 0) {
    return { segment: null, index: -1 };
  }

  let index = clamp(hintIndex, 0, list.length - 1);

  while (index < list.length - 1 && progressMs >= list[index].startMs + list[index].durationMs) {
    index += 1;
  }
  while (index > 0 && progressMs < list[index].startMs) {
    index -= 1;
  }

  return { segment: list[index], index };
}

export function computeSongSpectrumLevels(segment, barCount) {
  if (!segment) {
    return new Array(barCount).fill(0);
  }

  const loudnessNorm = clamp((Number(segment.loudnessMax ?? -60) + 60) / 60, 0, 1);
  const confidence = clamp(Number(segment.confidence) || 0, 0, 1);

  const levels = [];
  for (let i = 0; i < barCount; i += 1) {
    const pitch = sampleBandValue(segment.pitches, i, barCount);
    const timbre = sampleBandValue(segment.timbre, i, barCount);
    const leftWeight = 0.85 + (1 - i / Math.max(1, barCount - 1)) * 0.3;
    const raw = pitch * 0.56 + timbre * 0.24 + loudnessNorm * 0.35 + confidence * 0.12;
    levels.push(clamp(raw * leftWeight, 0, 1));
  }
  return levels;
}

export function computeProgressSyncedFallbackLevels(barCount, progressMs, durationMs, trackSeed) {
  const seed = hashStringToInt(trackSeed);
  const t = (progressMs ?? 0) / 1000;
  const normT = durationMs > 0 ? clamp((progressMs ?? 0) / durationMs, 0, 1) : 0;
  const levels = [];

  for (let i = 0; i < barCount; i += 1) {
    const phase = ((seed % 997) + i * 53) / 97;
    const rate = 1.4 + ((seed >> (i % 8)) % 5) * 0.18;
    const w1 = Math.sin(t * rate + phase);
    const w2 = Math.cos(t * (rate * 0.6 + 0.3) + phase * 1.7);
    const w3 = Math.sin(normT * 2 * Math.PI * (2.5 + (i % 4)) + phase);
    const combined = (w1 * 0.45 + w2 * 0.35 + w3 * 0.2 + 1) / 2;
    levels.push(clamp(combined, 0, 1));
  }
  return levels;
}

export function computeIdleLevels(barCount) {
  return new Array(barCount).fill(0.12);
}

export function smoothBarLevels(previousLevels, targetLevels, attackRate, decayRate) {
  return targetLevels.map((target, i) => {
    const previous = previousLevels[i] ?? 0;
    const rate = target >= previous ? attackRate : decayRate;
    const next = previous + (target - previous) * rate;
    return clamp(next, 0.08, 1);
  });
}

export function barLevelToHslColor(index, barCount, level) {
  const hue = (index / Math.max(1, barCount - 1)) * 285;
  const shiftedHue = (hue + level * 40) % 360;
  const saturation = clamp(55 + level * 35, 40, 95);
  const topLightness = clamp(45 + level * 28, 32, 97);
  const bottomLightness = clamp(28 + level * 22, 12, 78);
  return {
    top: `hsl(${shiftedHue.toFixed(1)}, ${saturation.toFixed(0)}%, ${topLightness.toFixed(0)}%)`,
    bottom: `hsl(${(shiftedHue + 14) % 360}, ${saturation.toFixed(0)}%, ${bottomLightness.toFixed(0)}%)`
  };
}

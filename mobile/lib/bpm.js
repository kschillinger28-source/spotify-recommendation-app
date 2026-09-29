export function computeBpmMatchPercent(currentTempo, candidateTempo) {
  const a = Number(currentTempo);
  const b = Number(candidateTempo);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return null;
  }

  const direct = Math.abs(a - b);
  const halfDoubleA = Math.abs(a * 2 - b);
  const halfDoubleB = Math.abs(a - b * 2);
  const distance = Math.min(direct, halfDoubleA, halfDoubleB);
  const percentDiff = (distance / a) * 100;

  return Math.max(0, Math.min(100, 100 - percentDiff));
}

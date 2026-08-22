import { getTrackAudioAnalysis } from "../../utils/spotify.js";

// Whole-track "audio embedding" built from Spotify's /audio-analysis segments:
// a duration-weighted average of each segment's 12-dim chroma (pitches) and
// 12-dim timbre vector. This is real measured signal (not a placeholder) —
// the closest thing to a genuine audio embedding available without running
// our own ML models (CLAP/OpenL3/etc. would need raw audio we don't have).
const EMBEDDING_CACHE_MAX = 500;
const EMBEDDING_CACHE_TRIM_TO = 420;
const trackEmbeddingCache = new Map(); // trackId -> { pitchVector, timbreVector } | null
let hasLoggedAudioAnalysisFailure = false;

function averageWeightedVectors(segments, field, dims) {
  const sums = new Array(dims).fill(0);
  let totalWeight = 0;
  for (const segment of segments) {
    const vector = Array.isArray(segment?.[field]) ? segment[field] : null;
    if (!vector || vector.length !== dims) {
      continue;
    }
    const weight = Math.max(0.01, Number(segment.duration) || 0.01);
    for (let i = 0; i < dims; i += 1) {
      sums[i] += vector[i] * weight;
    }
    totalWeight += weight;
  }
  return totalWeight > 0 ? sums.map((sum) => sum / totalWeight) : null;
}

export function computeTrackEmbeddingFromAnalysis(analysisPayload) {
  const segments = Array.isArray(analysisPayload?.segments) ? analysisPayload.segments : [];
  if (segments.length === 0) {
    return null;
  }
  const pitchVector = averageWeightedVectors(segments, "pitches", 12);
  const timbreVector = averageWeightedVectors(segments, "timbre", 12);
  if (!pitchVector || !timbreVector) {
    return null;
  }
  return { pitchVector, timbreVector };
}

function rememberEmbedding(trackId, embedding) {
  trackEmbeddingCache.set(trackId, embedding);
  if (trackEmbeddingCache.size > EMBEDDING_CACHE_MAX) {
    const overflow = trackEmbeddingCache.size - EMBEDDING_CACHE_TRIM_TO;
    const keys = trackEmbeddingCache.keys();
    for (let i = 0; i < overflow; i += 1) {
      const nextKey = keys.next().value;
      if (nextKey === undefined) {
        break;
      }
      trackEmbeddingCache.delete(nextKey);
    }
  }
}

/** Fetches (and caches indefinitely, keyed by trackId — audio content never changes) a track's embedding. */
export async function getTrackEmbedding(accessToken, trackId) {
  const id = String(trackId ?? "").trim();
  if (!id) {
    return null;
  }
  if (trackEmbeddingCache.has(id)) {
    return trackEmbeddingCache.get(id);
  }
  try {
    const analysis = await getTrackAudioAnalysis(accessToken, id);
    const embedding = computeTrackEmbeddingFromAnalysis(analysis);
    rememberEmbedding(id, embedding);
    return embedding;
  } catch (error) {
    if (!hasLoggedAudioAnalysisFailure) {
      hasLoggedAudioAnalysisFailure = true;
      console.error(
        "[audioSimilarity] /audio-analysis failed (logged once per process):",
        error.message
      );
    }
    rememberEmbedding(id, null);
    return null;
  }
}

/** Bulk fetch, one settled promise per track id, so a few failures don't block the rest. */
export async function getTrackEmbeddings(accessToken, trackIds) {
  const uniqueIds = [...new Set((trackIds ?? []).filter(Boolean))];
  const settled = await Promise.allSettled(
    uniqueIds.map(async (id) => [id, await getTrackEmbedding(accessToken, id)])
  );
  const byId = {};
  for (const entry of settled) {
    if (entry.status === "fulfilled") {
      const [id, embedding] = entry.value;
      byId[id] = embedding;
    }
  }
  return byId;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return null;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA <= 0 || normB <= 0) {
    return null;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Blends chroma + timbre cosine similarity into a single 0..1 "musical DNA" match.
 * Timbre (tone/production/instrumentation fingerprint) is weighted above raw chroma,
 * since harmonic/key compatibility is already scored separately via the Camelot wheel.
 * Returns null when either embedding is unavailable (caller should treat as "unknown", not "bad").
 */
export function embeddingSimilarity01(embeddingA, embeddingB) {
  if (!embeddingA || !embeddingB) {
    return null;
  }
  const pitchSim = cosineSimilarity(embeddingA.pitchVector, embeddingB.pitchVector);
  const timbreSim = cosineSimilarity(embeddingA.timbreVector, embeddingB.timbreVector);
  const parts = [];
  if (pitchSim !== null) {
    parts.push([pitchSim, 0.4]);
  }
  if (timbreSim !== null) {
    parts.push([timbreSim, 0.6]);
  }
  if (parts.length === 0) {
    return null;
  }
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  const blended = parts.reduce((sum, [sim, weight]) => sum + sim * weight, 0) / totalWeight;
  return Math.min(1, Math.max(0, (blended + 1) / 2));
}

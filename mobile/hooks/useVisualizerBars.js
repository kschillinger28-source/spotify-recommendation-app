import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import {
  computeIdleLevels,
  computeProgressSyncedFallbackLevels,
  computeSongSpectrumLevels,
  findSpectrumSegmentForProgress,
  smoothBarLevels
} from "../lib/visualizerMath";
import {
  SONG_SPECTRUM_CACHE_MAX,
  SONG_SPECTRUM_CACHE_TTL_MS,
  VISUALIZER_ATTACK_RATE,
  VISUALIZER_BAR_COUNT,
  VISUALIZER_DECAY_RATE
} from "../lib/config";

const spectrumCache = new Map();

function pruneSpectrumCache() {
  if (spectrumCache.size <= SONG_SPECTRUM_CACHE_MAX) {
    return;
  }
  const sorted = [...spectrumCache.entries()].sort((a, b) => a[1].cachedAtMs - b[1].cachedAtMs);
  for (const [key] of sorted.slice(0, spectrumCache.size - 100)) {
    spectrumCache.delete(key);
  }
}

export function useVisualizerBars({ trackId, trackUri, progressMs, durationMs, isPlaying }) {
  const [levels, setLevels] = useState(() => new Array(VISUALIZER_BAR_COUNT).fill(0.12));
  const segmentsRef = useRef([]);
  const segmentIndexRef = useRef(0);
  const currentLevelsRef = useRef(new Array(VISUALIZER_BAR_COUNT).fill(0.12));

  useEffect(() => {
    if (!trackId) {
      segmentsRef.current = [];
      return;
    }

    const cached = spectrumCache.get(trackId);
    if (cached && Date.now() - cached.cachedAtMs < SONG_SPECTRUM_CACHE_TTL_MS) {
      segmentsRef.current = cached.segments;
      return;
    }

    segmentsRef.current = [];
    segmentIndexRef.current = 0;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getAudioSpectrum(trackId);
        if (cancelled) {
          return;
        }
        const segments = Array.isArray(result?.segments) ? result.segments : [];
        spectrumCache.set(trackId, { cachedAtMs: Date.now(), segments });
        pruneSpectrumCache();
        segmentsRef.current = segments;
      } catch {
        segmentsRef.current = [];
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trackId]);

  useEffect(() => {
    const id = setInterval(() => {
      let targetLevels;

      if (segmentsRef.current.length > 0) {
        const { segment, index } = findSpectrumSegmentForProgress(
          segmentsRef.current,
          progressMs ?? 0,
          segmentIndexRef.current
        );
        segmentIndexRef.current = index;
        targetLevels = computeSongSpectrumLevels(segment, VISUALIZER_BAR_COUNT);
      } else if (trackUri && isPlaying) {
        targetLevels = computeProgressSyncedFallbackLevels(
          VISUALIZER_BAR_COUNT,
          progressMs ?? 0,
          durationMs ?? 0,
          trackUri
        );
      } else {
        targetLevels = computeIdleLevels(VISUALIZER_BAR_COUNT);
      }

      currentLevelsRef.current = smoothBarLevels(
        currentLevelsRef.current,
        targetLevels,
        VISUALIZER_ATTACK_RATE,
        VISUALIZER_DECAY_RATE
      );
      setLevels([...currentLevelsRef.current]);
    }, 60);

    return () => clearInterval(id);
  }, [trackUri, progressMs, durationMs, isPlaying]);

  return levels;
}

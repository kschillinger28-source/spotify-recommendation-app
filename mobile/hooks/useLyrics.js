import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import {
  buildEstimatedTimedLinesFromChunks,
  buildLyricChunks,
  computeLyricLineOpacity,
  findLyricDisplayIndex,
  normalizeTimedLyricLines
} from "../lib/lyricsSync";
import { LYRICS_CACHE_TTL_MS } from "../lib/config";

const lyricsCache = new Map();

function cacheKey(artist, title) {
  return `${String(artist ?? "").trim().toLowerCase()}::${String(title ?? "").trim().toLowerCase()}`;
}

function pruneLyricsCache() {
  if (lyricsCache.size <= 120) {
    return;
  }
  const sorted = [...lyricsCache.entries()].sort((a, b) => a[1].cachedAtMs - b[1].cachedAtMs);
  for (const [key] of sorted.slice(0, lyricsCache.size - 90)) {
    lyricsCache.delete(key);
  }
}

export function useLyrics({ track, progressMs, lyricOffsetMs = 0 }) {
  const [lines, setLines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [found, setFound] = useState(false);
  const currentKeyRef = useRef(null);

  useEffect(() => {
    const artist = track?.artistNames?.[0];
    const title = track?.name;
    if (!artist || !title) {
      setLines([]);
      setFound(false);
      return;
    }

    const key = cacheKey(artist, title);
    if (key === currentKeyRef.current) {
      return;
    }
    currentKeyRef.current = key;

    const cached = lyricsCache.get(key);
    if (cached && Date.now() - cached.cachedAtMs < LYRICS_CACHE_TTL_MS) {
      setLines(cached.lines);
      setFound(cached.found);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const result = await api.getLyrics({ artist, title });
        if (cancelled || currentKeyRef.current !== key) {
          return;
        }
        let resolvedLines = normalizeTimedLyricLines(result?.timedLines);
        if (resolvedLines.length === 0 && result?.lyrics) {
          const chunks = buildLyricChunks(result.lyrics);
          resolvedLines = buildEstimatedTimedLinesFromChunks(chunks, track?.durationMs ?? 0);
        }
        lyricsCache.set(key, { cachedAtMs: Date.now(), lines: resolvedLines, found: Boolean(result?.found) });
        pruneLyricsCache();
        setLines(resolvedLines);
        setFound(Boolean(result?.found));
      } catch {
        if (!cancelled) {
          setLines([]);
          setFound(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [track?.uri, track?.name, track?.artistNames, track?.durationMs]);

  const adjustedProgressMs = (progressMs ?? 0) + (lyricOffsetMs ?? 0);
  const activeIndex = findLyricDisplayIndex(lines, adjustedProgressMs);
  const activeLine = activeIndex >= 0 ? lines[activeIndex] : null;
  const nextLine = activeIndex >= 0 ? lines[activeIndex + 1] : null;
  const opacity = activeLine
    ? computeLyricLineOpacity(
        adjustedProgressMs,
        activeLine.startMs,
        nextLine ? nextLine.startMs : activeLine.startMs + 4000
      )
    : 0;

  return {
    isLoading,
    found,
    activeLineText: activeLine?.text ?? "",
    opacity
  };
}

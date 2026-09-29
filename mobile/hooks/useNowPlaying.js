import { useCallback, useEffect, useRef, useState } from "react";
import { NOW_PLAYING_POLL_ACTIVE_MS, NOW_PLAYING_POLL_IDLE_MS, NOW_PLAYING_TICKER_MS } from "../lib/config";
import * as api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function useNowPlaying({ isActive = false } = {}) {
  const { isLoggedIn } = useAuth();
  const [playback, setPlayback] = useState(null);
  const [hasActivePlayback, setHasActivePlayback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const tickerStateRef = useRef({
    trackUri: null,
    baseProgressMs: 0,
    durationMs: 0,
    isPlaying: false,
    renderedAtMs: Date.now()
  });
  const [interpolatedProgressMs, setInterpolatedProgressMs] = useState(0);
  const inFlightRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      return null;
    }
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    inFlightRef.current = (async () => {
      try {
        const result = await api.getCurrentPlayback();
        setHasActivePlayback(Boolean(result?.hasActivePlayback));
        setPlayback(result?.playback ?? null);
        setError(null);

        const item = result?.playback?.item;
        tickerStateRef.current = {
          trackUri: item?.uri ?? null,
          baseProgressMs: Number(result?.playback?.progress_ms ?? 0),
          durationMs: Number(item?.duration_ms ?? 0),
          isPlaying: Boolean(result?.playback?.is_playing),
          renderedAtMs: Date.now()
        };
        return result;
      } catch (err) {
        setError(err?.message ?? "Could not load playback state.");
        return null;
      } finally {
        setIsLoading(false);
        inFlightRef.current = null;
      }
    })();

    return inFlightRef.current;
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }
    refresh();
    const intervalMs = isActive ? NOW_PLAYING_POLL_ACTIVE_MS : NOW_PLAYING_POLL_IDLE_MS;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [isLoggedIn, isActive, refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      const state = tickerStateRef.current;
      if (!state.trackUri) {
        setInterpolatedProgressMs(0);
        return;
      }
      const elapsed = state.isPlaying ? Date.now() - state.renderedAtMs : 0;
      const next = Math.min(state.durationMs || Infinity, state.baseProgressMs + elapsed);
      setInterpolatedProgressMs(next);
    }, NOW_PLAYING_TICKER_MS);
    return () => clearInterval(id);
  }, []);

  return {
    playback,
    hasActivePlayback,
    isLoading,
    error,
    interpolatedProgressMs,
    refresh
  };
}

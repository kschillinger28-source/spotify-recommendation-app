import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { getPendingQueueTarget, setPendingQueueTarget } from "../lib/storage";
import {
  QUEUE_POLL_INTERVAL_MS,
  QUEUE_POLL_MAX_ATTEMPTS,
  SEEK_VERIFY_WAITS_MS,
  SEEK_MAX_DRIFT_MS
} from "../lib/config";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fadeVolume(deviceId, fromPercent, toPercent, durationMs) {
  const delta = Math.abs(toPercent - fromPercent);
  if (durationMs <= 220 || delta <= 4) {
    await api.setVolume({ volumePercent: Math.round(toPercent), deviceId });
    return;
  }
  const steps = Math.min(5, Math.max(2, Math.round(durationMs / 360)));
  const stepDelayMs = Math.max(120, Math.round(durationMs / steps));
  for (let i = 1; i <= steps; i += 1) {
    const percent = fromPercent + ((toPercent - fromPercent) * i) / steps;
    await api.setVolume({ volumePercent: Math.round(percent), deviceId });
    if (i < steps) {
      await wait(stepDelayMs);
    }
  }
}

export function useQueueAndSeekTransition() {
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [fallback, setFallback] = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    (async () => {
      const pending = await getPendingQueueTarget();
      if (pending) {
        setStatusMessage("Resuming a queued track from before the app restarted…");
        startPollingForQueuedTrack(pending);
      }
    })();
    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attemptSeekAndVerify = useCallback(async (target) => {
    if (target.seekDelayMs > 0) {
      await wait(target.seekDelayMs);
    }

    setStatus("seeking");
    setStatusMessage(`Seeking to ${Math.round(target.desiredOffsetMs / 1000)}s…`);

    try {
      if (target.smoothTransitionEnabled) {
        const snapshot = await api.getCurrentPlayback();
        const baseVolume = Math.max(12, Math.min(100, Number(snapshot?.playback?.device?.volume_percent ?? 65)));
        const outgoingEndRatio = target.transitionHints?.outgoingEndRatio ?? 0.35;
        const volumeDelta = target.transitionHints?.volumeNormalizationPercentDelta ?? 0;
        const dippedVolume = Math.max(8, Math.round(baseVolume * outgoingEndRatio));
        const endVolume = Math.max(5, Math.min(100, baseVolume + volumeDelta));
        const fadeHalfMs = Math.max(100, Math.min(3000, Math.round(target.smoothFadeDurationMs / 2)));

        await fadeVolume(target.deviceId, baseVolume, dippedVolume, fadeHalfMs);
        await api.seekPlayback({ positionMs: target.desiredOffsetMs, deviceId: target.deviceId });
        await wait(220);
        await fadeVolume(target.deviceId, dippedVolume, endVolume, fadeHalfMs);
      } else {
        await api.seekPlayback({ positionMs: target.desiredOffsetMs, deviceId: target.deviceId });
      }
    } catch (error) {
      setStatus("fallback");
      setFallback({ desiredOffsetMs: target.desiredOffsetMs, reason: error?.message });
      await setPendingQueueTarget(null);
      return;
    }

    for (const waitMs of SEEK_VERIFY_WAITS_MS) {
      await wait(waitMs);
      try {
        const snapshot = await api.getCurrentPlayback();
        const currentUri = snapshot?.playback?.item?.uri;
        if (currentUri && currentUri !== target.trackUri) {
          setStatus("fallback");
          setFallback({ desiredOffsetMs: target.desiredOffsetMs, reason: "Playback moved to a different track before the seek could be verified." });
          await setPendingQueueTarget(null);
          return;
        }
        const progressMs = Number(snapshot?.playback?.progress_ms ?? 0);
        if (Math.abs(progressMs - target.desiredOffsetMs) <= SEEK_MAX_DRIFT_MS) {
          setStatus("done");
          setStatusMessage("Seek confirmed.");
          await setPendingQueueTarget(null);
          return;
        }
      } catch {
        // Try again on the next verify wait.
      }
    }

    setStatus("fallback");
    setFallback({
      desiredOffsetMs: target.desiredOffsetMs,
      reason: "Playback position lagged behind — audio may still be correct, but drag to confirm."
    });
    await setPendingQueueTarget(null);
  }, []);

  const startPollingForQueuedTrack = useCallback(
    async (target) => {
      setStatus("waiting_for_device");
      setStatusMessage(`Waiting for "${target.trackName ?? "the track"}" to start playing…`);
      cancelRef.current = false;

      let sawDifferentTrack = !target.mustSeeDifferentTrackFirst;

      for (let attempt = 0; attempt < QUEUE_POLL_MAX_ATTEMPTS; attempt += 1) {
        if (cancelRef.current) {
          return;
        }
        await wait(QUEUE_POLL_INTERVAL_MS);

        let snapshot;
        try {
          snapshot = await api.getCurrentPlayback();
        } catch {
          continue;
        }

        const currentUri = snapshot?.playback?.item?.uri;
        if (!sawDifferentTrack) {
          if (currentUri && currentUri !== target.trackUri) {
            sawDifferentTrack = true;
          }
          continue;
        }

        if (currentUri === target.trackUri) {
          await attemptSeekAndVerify(target);
          return;
        }
      }

      setStatus("fallback");
      setFallback({
        desiredOffsetMs: target.desiredOffsetMs,
        reason: `Couldn't confirm "${target.trackName ?? "the track"}" started within the expected time.`
      });
      await setPendingQueueTarget(null);
    },
    [attemptSeekAndVerify]
  );

  const queueAndMaybeSeek = useCallback(
    async ({
      trackUri,
      trackName,
      deviceId,
      desiredOffsetMs = 0,
      seekDelayMs = 0,
      autoSeekEnabled = true,
      smoothTransitionEnabled = true,
      smoothFadeDurationMs = 2500,
      transitionHints = null,
      forceQueueOnly = false
    }) => {
      setStatus("queuing");
      setStatusMessage("Adding to queue…");
      setFallback(null);

      const queueResult = await api.queueTrack({ trackUri, deviceId });
      const resolvedDeviceId = queueResult?.deviceId ?? deviceId;

      if (forceQueueOnly || !autoSeekEnabled || desiredOffsetMs <= 0) {
        setStatus("done");
        setStatusMessage("Added to queue.");
        return { deviceId: resolvedDeviceId };
      }

      let mustSeeDifferentTrackFirst = false;
      try {
        const currentSnapshot = await api.getCurrentPlayback();
        mustSeeDifferentTrackFirst = currentSnapshot?.playback?.item?.uri === trackUri;
      } catch {
        // Assume no conflict if we can't check.
      }

      const target = {
        trackUri,
        trackName,
        deviceId: resolvedDeviceId,
        desiredOffsetMs,
        seekDelayMs,
        smoothTransitionEnabled,
        smoothFadeDurationMs,
        transitionHints,
        mustSeeDifferentTrackFirst
      };

      await setPendingQueueTarget(target);
      startPollingForQueuedTrack(target);
      return { deviceId: resolvedDeviceId };
    },
    [startPollingForQueuedTrack]
  );

  const dismissFallback = useCallback(() => {
    setFallback(null);
    setStatus("idle");
  }, []);

  return { status, statusMessage, fallback, queueAndMaybeSeek, dismissFallback };
}

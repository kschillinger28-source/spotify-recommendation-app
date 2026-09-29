import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { computeBpmMatchPercent } from "../lib/bpm";
import { AUTOPILOT_TICK_MS, AUTOPILOT_TRIGGER_WINDOW_MS } from "../lib/config";
import { useAuth } from "../context/AuthContext";

export function useDjRecommendation({
  playback,
  buildUserContext,
  queueAndMaybeSeek,
  armFlowInjection,
  deviceId,
  autopilotEnabled,
  autoSeekEnabled,
  smoothTransitionEnabled,
  smoothFadeSeconds,
  seekDelaySeconds
}) {
  const { sessionId } = useAuth();
  const [plan, setPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const lastAutopilotTriggerUriRef = useRef(null);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const userContext = await buildUserContext();
      const result = await api.recommendNext({ sessionId, userContext, forDj: true });
      setPlan(result);
      return result;
    } catch (err) {
      setError(err?.message ?? "Could not build a recommendation.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, buildUserContext]);

  const queueCandidate = useCallback(
    async (candidate, recommendationPlan, { forceQueueOnly = false } = {}) => {
      if (!candidate) {
        return;
      }
      const currentTempo = recommendationPlan?.currentTrack?.tempo;
      const bpmMatchPercent = computeBpmMatchPercent(currentTempo, candidate.tempo);
      const desiredOffsetMs =
        recommendationPlan?.transitionPlan?.recommendedOffsetMs ??
        recommendationPlan?.entryPoint?.recommendedOffsetMs ??
        0;

      if (!forceQueueOnly && bpmMatchPercent !== null && bpmMatchPercent > 90 && recommendationPlan?.currentTrack?.uri) {
        await armFlowInjection({
          sourceTrackUri: recommendationPlan.currentTrack.uri,
          targetTrackUri: candidate.uri,
          targetTrackName: candidate.name,
          positionMs: desiredOffsetMs,
          deviceId,
          bpmMatchPercent
        });
        return;
      }

      await queueAndMaybeSeek({
        trackUri: candidate.uri,
        trackName: candidate.name,
        deviceId,
        desiredOffsetMs,
        seekDelayMs: Math.round((seekDelaySeconds ?? 0) * 1000),
        autoSeekEnabled: forceQueueOnly ? false : autoSeekEnabled,
        smoothTransitionEnabled,
        smoothFadeDurationMs: Math.round((smoothFadeSeconds ?? 2.5) * 1000),
        transitionHints: {
          outgoingEndRatio: recommendationPlan?.transitionPlan?.mockDuckProfile?.outgoingEndRatio,
          volumeNormalizationPercentDelta: recommendationPlan?.transitionPlan?.volumeNormalizationPercentDelta
        },
        forceQueueOnly
      });
    },
    [armFlowInjection, queueAndMaybeSeek, deviceId, autoSeekEnabled, smoothTransitionEnabled, smoothFadeSeconds, seekDelaySeconds]
  );

  const queueTopThree = useCallback(
    async (recommendationPlan) => {
      const candidates = (recommendationPlan?.topCandidates ?? []).slice(0, 3);
      for (const candidate of candidates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await api.queueTrack({ trackUri: candidate.uri, deviceId });
        } catch {
          // Continue queueing the remaining candidates even if one fails.
        }
      }
    },
    [deviceId]
  );

  useEffect(() => {
    if (!autopilotEnabled || !playback?.item) {
      return undefined;
    }

    const id = setInterval(async () => {
      const durationMs = Number(playback.item?.duration_ms ?? 0);
      const progressMs = Number(playback.progress_ms ?? 0);
      const remainingMs = durationMs - progressMs;
      const currentUri = playback.item?.uri;

      const inTriggerWindow =
        remainingMs <= AUTOPILOT_TRIGGER_WINDOW_MS.start && remainingMs >= AUTOPILOT_TRIGGER_WINDOW_MS.end;

      if (!inTriggerWindow || currentUri === lastAutopilotTriggerUriRef.current) {
        return;
      }

      lastAutopilotTriggerUriRef.current = currentUri;
      const result = await generate();
      if (result?.selectedCandidate) {
        await queueCandidate(result.selectedCandidate, result);
      }
    }, AUTOPILOT_TICK_MS);

    return () => clearInterval(id);
  }, [autopilotEnabled, playback, generate, queueCandidate]);

  useEffect(() => {
    if (!autopilotEnabled) {
      lastAutopilotTriggerUriRef.current = null;
    }
  }, [autopilotEnabled]);

  return { plan, isGenerating, error, generate, queueCandidate, queueTopThree };
}

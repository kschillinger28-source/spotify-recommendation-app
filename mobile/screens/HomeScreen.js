import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import NowPlayingHero from "../components/NowPlayingHero";
import LyricsPanel from "../components/LyricsPanel";
import ContextBadges from "../components/ContextBadges";
import RecommendationCard from "../components/RecommendationCard";
import { useAuth } from "../context/AuthContext";
import { useSession } from "../context/SessionContext";
import { useNowPlaying } from "../hooks/useNowPlaying";
import { useQueueAndSeekTransition } from "../hooks/useQueueAndSeekTransition";
import { useFlowInjection } from "../hooks/useFlowInjection";
import { useDjRecommendation } from "../hooks/useDjRecommendation";
import { useLyrics } from "../hooks/useLyrics";
import { useVisualizerBars } from "../hooks/useVisualizerBars";
import { buildUserContext, getEnvironmentSignals } from "../lib/environmentContext";
import { EARLY_SKIP_THRESHOLD_MS } from "../lib/config";
import * as api from "../lib/api";

export default function HomeScreen() {
  const { sessionId } = useAuth();
  const { prefs, setRemixMode, setAutopilotEnabled, setMoodLevel, setNostalgiaSlider, updatePrefs } = useSession();
  const [countryCode, setCountryCode] = useState(null);
  const [moodLevel, setLocalMoodLevel] = useState(prefs.moodLevel);
  const [nostalgiaSlider, setLocalNostalgiaSlider] = useState(prefs.nostalgiaSlider);
  const [envSignals, setEnvSignals] = useState(null);

  const flowInjection = useFlowInjection();
  const queueTransition = useQueueAndSeekTransition();

  const isActive = prefs.autopilotEnabled || Boolean(flowInjection.pending) || queueTransition.status === "waiting_for_device" || queueTransition.status === "seeking";
  const { playback, hasActivePlayback, interpolatedProgressMs, refresh } = useNowPlaying({ isActive });

  useEffect(() => {
    api.getProfile().then((profile) => setCountryCode(profile?.country ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    getEnvironmentSignals(countryCode).then(setEnvSignals).catch(() => {});
  }, [countryCode]);

  const buildContext = useCallback(async () => {
    const signals = envSignals ?? (await getEnvironmentSignals(countryCode));
    return buildUserContext({ countryCode, moodLevel, nostalgiaSlider, envSignals: signals });
  }, [countryCode, moodLevel, nostalgiaSlider, envSignals]);

  const djRecommendation = useDjRecommendation({
    playback,
    buildUserContext: buildContext,
    queueAndMaybeSeek: queueTransition.queueAndMaybeSeek,
    armFlowInjection: flowInjection.arm,
    deviceId: prefs.deviceId || undefined,
    autopilotEnabled: prefs.autopilotEnabled,
    autoSeekEnabled: prefs.autoSeekEnabled,
    smoothTransitionEnabled: prefs.smoothTransitionEnabled,
    smoothFadeSeconds: prefs.smoothFadeSeconds,
    seekDelaySeconds: prefs.seekDelaySeconds
  });

  const track = playback?.item ?? null;
  const lyrics = useLyrics({
    track: track
      ? { uri: track.uri, name: track.name, artistNames: (track.artists ?? []).map((a) => a.name), durationMs: track.duration_ms }
      : null,
    progressMs: interpolatedProgressMs,
    lyricOffsetMs: prefs.lyricOffsetMs
  });

  const levels = useVisualizerBars({
    trackId: track?.id,
    trackUri: track?.uri,
    progressMs: interpolatedProgressMs,
    durationMs: track?.duration_ms,
    isPlaying: Boolean(playback?.is_playing)
  });

  const onPlayPause = useCallback(async () => {
    const deviceId = prefs.deviceId || undefined;
    if (playback?.is_playing) {
      await api.pausePlayback({ deviceId });
    } else {
      await api.resumePlayback({ deviceId });
    }
    refresh();
  }, [playback?.is_playing, prefs.deviceId, refresh]);

  const onNext = useCallback(async () => {
    if (track && interpolatedProgressMs <= EARLY_SKIP_THRESHOLD_MS) {
      api
        .recordSkipFeedback({
          sessionId,
          trackId: track.id,
          progressMs: interpolatedProgressMs,
          artistIds: (track.artists ?? []).map((a) => a.id)
        })
        .catch(() => {});
    }
    await api.skipToNext({ deviceId: prefs.deviceId || undefined });
    refresh();
  }, [track, interpolatedProgressMs, sessionId, prefs.deviceId, refresh]);

  const onPrevious = useCallback(async () => {
    await api.skipToPrevious({ deviceId: prefs.deviceId || undefined });
    refresh();
  }, [prefs.deviceId, refresh]);

  const onCycleTempUnit = useCallback(() => {
    const order = ["auto", "celsius", "fahrenheit"];
    const nextUnit = order[(order.indexOf(prefs.tempDisplayUnit) + 1) % order.length];
    updatePrefs({ tempDisplayUnit: nextUnit });
  }, [prefs.tempDisplayUnit, updatePrefs]);

  const statusText = useMemo(() => {
    if (flowInjection.pending) return flowInjection.statusMessage;
    if (queueTransition.status !== "idle" && queueTransition.status !== "done") return queueTransition.statusMessage;
    return null;
  }, [flowInjection, queueTransition]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor="#1ed760" />}
    >
      <NowPlayingHero
        track={track}
        progressMs={interpolatedProgressMs}
        isPlaying={Boolean(playback?.is_playing)}
        levels={levels}
        onPrevious={onPrevious}
        onPlayPause={onPlayPause}
        onNext={onNext}
      />

      {!hasActivePlayback ? (
        <Text style={styles.hint}>
          Open Spotify on any device and start playing something, then pull to refresh.
        </Text>
      ) : null}

      <LyricsPanel {...lyrics} />

      {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
      {queueTransition.fallback ? (
        <Text style={styles.fallbackText}>
          {queueTransition.fallback.reason} Drag to about{" "}
          {Math.floor(queueTransition.fallback.desiredOffsetMs / 60000)}:
          {String(Math.floor((queueTransition.fallback.desiredOffsetMs % 60000) / 1000)).padStart(2, "0")}.
        </Text>
      ) : null}

      <ContextBadges
        moodLevel={moodLevel}
        nostalgiaSlider={nostalgiaSlider}
        envSignals={envSignals}
        countryCode={countryCode}
        tempDisplayUnit={prefs.tempDisplayUnit}
        onCycleTempUnit={onCycleTempUnit}
      />

      <View style={styles.sliderBlock}>
        <Text style={styles.sliderLabel}>Mood</Text>
        <Slider
          minimumValue={0}
          maximumValue={100}
          value={moodLevel}
          minimumTrackTintColor="#1ed760"
          onValueChange={setLocalMoodLevel}
          onSlidingComplete={setMoodLevel}
        />
      </View>

      <View style={styles.sliderBlock}>
        <Text style={styles.sliderLabel}>Nostalgia</Text>
        <Slider
          minimumValue={0}
          maximumValue={100}
          value={nostalgiaSlider}
          minimumTrackTintColor="#1ed760"
          onValueChange={setLocalNostalgiaSlider}
          onSlidingComplete={setNostalgiaSlider}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>DJ Remix Mode</Text>
        <Switch value={prefs.remixModeEnabled} onValueChange={setRemixMode} trackColor={{ true: "#1ed760" }} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>DJ Autopilot</Text>
        <Switch value={prefs.autopilotEnabled} onValueChange={setAutopilotEnabled} trackColor={{ true: "#1ed760" }} />
      </View>

      <View style={styles.generateButtonWrap}>
        <Text onPress={djRecommendation.generate} style={styles.generateButton}>
          Generate Vibe
        </Text>
      </View>

      {djRecommendation.error ? <Text style={styles.fallbackText}>{djRecommendation.error}</Text> : null}

      <RecommendationCard
        plan={djRecommendation.plan}
        isGenerating={djRecommendation.isGenerating}
        onQueueBest={djRecommendation.queueCandidate}
        onQueueTopThree={djRecommendation.queueTopThree}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212"
  },
  content: {
    padding: 16,
    paddingBottom: 48
  },
  hint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10
  },
  statusText: {
    color: "#b3b3b3",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12
  },
  fallbackText: {
    color: "#ffa42b",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 12
  },
  sliderBlock: {
    marginTop: 18
  },
  sliderLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16
  },
  switchLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600"
  },
  generateButtonWrap: {
    marginTop: 20,
    alignItems: "center"
  },
  generateButton: {
    color: "#04120a",
    backgroundColor: "#1ed760",
    fontWeight: "700",
    fontSize: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    overflow: "hidden"
  }
});

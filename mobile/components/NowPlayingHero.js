import { Image, StyleSheet, Text, View } from "react-native";
import VisualizerBars from "./VisualizerBars";
import TransportControls from "./TransportControls";

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function NowPlayingHero({
  track,
  progressMs,
  isPlaying,
  levels,
  onPrevious,
  onPlayPause,
  onNext
}) {
  if (!track) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nothing is playing right now.</Text>
        <Text style={styles.emptySubtext}>Start a track on Spotify, then come back here.</Text>
      </View>
    );
  }

  const durationMs = Number(track.duration_ms ?? 0);
  const progressRatio = durationMs > 0 ? Math.min(1, (progressMs ?? 0) / durationMs) : 0;
  const albumImageUrl = track.album?.images?.[0]?.url;

  return (
    <View style={styles.container}>
      {albumImageUrl ? (
        <Image source={{ uri: albumImageUrl }} style={StyleSheet.absoluteFill} blurRadius={28} />
      ) : null}
      <View style={styles.scrim} />

      <View style={styles.content}>
        {albumImageUrl ? (
          <Image source={{ uri: albumImageUrl }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artPlaceholder]} />
        )}

        <VisualizerBars levels={levels} />

        <Text style={styles.title} numberOfLines={1}>
          {track.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {(track.artists ?? []).map((artist) => artist.name).join(", ")}
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{formatMs(progressMs)}</Text>
          <Text style={styles.progressLabel}>{formatMs(durationMs)}</Text>
        </View>

        <TransportControls isPlaying={isPlaying} onPrevious={onPrevious} onPlayPause={onPlayPause} onNext={onNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#15151f"
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18,18,18,0.72)"
  },
  content: {
    padding: 20,
    alignItems: "center"
  },
  art: {
    width: 180,
    height: 180,
    borderRadius: 4,
    marginBottom: 16
  },
  artPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  title: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center"
  },
  subtitle: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center"
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 16,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#1ed760"
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 6
  },
  progressLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11
  },
  emptyContainer: {
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 32,
    alignItems: "center"
  },
  emptyText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600"
  },
  emptySubtext: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center"
  }
});

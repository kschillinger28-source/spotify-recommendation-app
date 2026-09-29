import { Image, Pressable, StyleSheet, Text, View } from "react-native";

function formatMs(ms) {
  const totalSeconds = Math.floor((Number(ms) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function TrackRow({ track, onPlayNow, onQueue, onQueueAndSeek }) {
  return (
    <View style={styles.row}>
      {track.albumImageUrl ? (
        <Image source={{ uri: track.albumImageUrl }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {track.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {(track.artistNames ?? []).join(", ")} · {formatMs(track.durationMs)}
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => onPlayNow(track)}>
            <Text style={styles.actionText}>Play Now</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => onQueue(track)}>
            <Text style={styles.actionText}>Queue</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => onQueueAndSeek(track)}>
            <Text style={styles.actionText}>Queue + Seek</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)"
  },
  art: {
    width: 52,
    height: 52,
    borderRadius: 6,
    marginRight: 12
  },
  artPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  info: {
    flex: 1
  },
  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600"
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2
  },
  actions: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8
  },
  actionButton: {
    backgroundColor: "rgba(30,215,96,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  actionText: {
    color: "#1ed760",
    fontSize: 11,
    fontWeight: "700"
  }
});

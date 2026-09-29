import { Pressable, StyleSheet, Text, View } from "react-native";

export default function TransportControls({ isPlaying, onPrevious, onPlayPause, onNext }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.sideButton} onPress={onPrevious}>
        <Text style={styles.sideButtonText}>⏮</Text>
      </Pressable>
      <Pressable style={styles.playButton} onPress={onPlayPause}>
        <Text style={styles.playButtonText}>{isPlaying ? "⏸" : "▶"}</Text>
      </Pressable>
      <Pressable style={styles.sideButton} onPress={onNext}>
        <Text style={styles.sideButtonText}>⏭</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 18
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  sideButtonText: {
    color: "#ffffff",
    fontSize: 20
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1ed760"
  },
  playButtonText: {
    color: "#04120a",
    fontSize: 26
  }
});

import { StyleSheet, Text, View } from "react-native";

export default function LyricsPanel({ activeLineText, opacity, isLoading, found }) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Loading lyrics…</Text>
      </View>
    );
  }

  if (!found && !activeLineText) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>No lyrics available for this track.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.line, { opacity }]} numberOfLines={2}>
        {activeLineText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20
  },
  line: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center"
  },
  placeholder: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    textAlign: "center"
  }
});

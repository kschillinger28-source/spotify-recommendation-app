import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { barLevelToHslColor } from "../lib/visualizerMath";

export default function VisualizerBars({ levels, height = 90 }) {
  return (
    <View style={[styles.row, { height }]} pointerEvents="none">
      {levels.map((level, index) => {
        const colors = barLevelToHslColor(index, levels.length, level);
        return (
          <View key={index} style={styles.barTrack}>
            <LinearGradient
              colors={[colors.top, colors.bottom]}
              style={[styles.bar, { height: `${Math.max(8, level * 100)}%` }]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 4
  },
  barTrack: {
    flex: 1,
    marginHorizontal: 1.5,
    height: "100%",
    justifyContent: "flex-end"
  },
  bar: {
    width: "100%",
    borderRadius: 3
  }
});

import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatOutdoorTempBadge,
  moodLabelFromLevel,
  nostalgiaLabelFromLevel,
  resolveTempDisplayFahrenheit,
  weatherEmoji
} from "../lib/environmentContext";

function Badge({ children, onPress }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.badge} onPress={onPress}>
      <Text style={styles.badgeText}>{children}</Text>
    </Wrapper>
  );
}

export default function ContextBadges({ moodLevel, nostalgiaSlider, envSignals, countryCode, tempDisplayUnit, onCycleTempUnit }) {
  const useFahrenheit = resolveTempDisplayFahrenheit(tempDisplayUnit, countryCode);

  return (
    <View style={styles.row}>
      <Badge>🎚️ {moodLabelFromLevel(moodLevel)}</Badge>
      <Badge>⏳ {nostalgiaLabelFromLevel(nostalgiaSlider)}</Badge>
      {envSignals?.seasonVibe ? <Badge>🗓️ {envSignals.seasonVibe}</Badge> : null}
      <Badge onPress={onCycleTempUnit}>
        🌡️ {formatOutdoorTempBadge(envSignals?.tempC, useFahrenheit)}
      </Badge>
      <Badge>{weatherEmoji(envSignals?.weather)}</Badge>
      <Badge>🌍 {countryCode ?? "—"}</Badge>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  badgeText: {
    color: "#e6e6e6",
    fontSize: 12,
    fontWeight: "500"
  }
});

import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function RecommendationCard({ plan, isGenerating, onQueueBest, onQueueTopThree }) {
  if (isGenerating && !plan) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>Building your next vibe…</Text>
      </View>
    );
  }

  if (!plan) {
    return null;
  }

  const candidate = plan.selectedCandidate;
  if (!candidate) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>No recommendation available right now.</Text>
      </View>
    );
  }

  const vibeScore = Math.round(candidate.score ?? candidate.vibeMatch ?? 0);
  const isHighMatch = vibeScore >= 80;
  const eraLabel = candidate.temporalVibe?.eraLabel;
  const eraAlignment = candidate.temporalVibe?.eraAlignmentPercent;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {candidate.albumImageUrl ? (
          <Image source={{ uri: candidate.albumImageUrl }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artPlaceholder]} />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {candidate.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {(candidate.artistNames ?? []).join(", ")}
          </Text>
          <Text style={styles.strategy} numberOfLines={2}>
            {plan.transitionPlan?.transitionLabel ?? plan.transitionPlan?.strategy}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={[styles.chip, isHighMatch && styles.chipGlow]}>
          <Text style={styles.chipText}>{vibeScore}% vibe match</Text>
        </View>
        {eraLabel ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {eraLabel}
              {Number.isFinite(eraAlignment) ? ` · ${Math.round(eraAlignment)}%` : ""}
            </Text>
          </View>
        ) : null}
        {Number.isFinite(plan.entryPoint?.recommendedOffsetSeconds) ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>Start ~{Math.round(plan.entryPoint.recommendedOffsetSeconds)}s</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => onQueueBest(candidate, plan)}>
          <Text style={styles.primaryButtonText}>Queue best + seek</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => onQueueTopThree(plan)}>
          <Text style={styles.secondaryButtonText}>Queue top 3</Text>
        </Pressable>
      </View>

      {(plan.topCandidates ?? []).slice(0, 5).map((item) => (
        <View key={item.uri} style={styles.candidateRow}>
          <Text style={styles.candidateName} numberOfLines={1}>
            {item.name} — {(item.artistNames ?? []).join(", ")}
          </Text>
          <Text style={styles.candidateScore}>{Math.round(item.score ?? 0)}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: 16,
    marginTop: 16
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center"
  },
  header: {
    flexDirection: "row"
  },
  art: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12
  },
  artPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center"
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    marginTop: 2
  },
  strategy: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 4
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999
  },
  chipGlow: {
    backgroundColor: "rgba(30,215,96,0.28)"
  },
  chipText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600"
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1ed760",
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#04120a",
    fontWeight: "700",
    fontSize: 13
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13
  },
  candidateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    marginTop: 6
  },
  candidateName: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    flex: 1,
    marginRight: 8
  },
  candidateScore: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600"
  }
});

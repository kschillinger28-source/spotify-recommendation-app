import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import TrackRow from "../components/TrackRow";
import { useAuth } from "../context/AuthContext";
import { useSession } from "../context/SessionContext";
import { useQueueAndSeekTransition } from "../hooks/useQueueAndSeekTransition";
import * as api from "../lib/api";

export default function SearchScreen() {
  const { sessionId } = useAuth();
  const { prefs } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const debounceRef = useRef(null);
  const { queueAndMaybeSeek, statusMessage: transitionMessage } = useQueueAndSeekTransition();

  const runSearch = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (trimmed.length < 2) {
        setResults([]);
        return;
      }
      try {
        const result = await api.searchTracks(trimmed, 10);
        setResults(result?.tracks ?? []);
        api.recordSearchAffinity({ sessionId, query: trimmed }).catch(() => {});
      } catch (error) {
        setStatusMessage(error?.message ?? "Search failed.");
      }
    },
    [sessionId]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  const deviceId = prefs.deviceId || undefined;

  const onPlayNow = useCallback(
    async (track) => {
      setStatusMessage(`Playing "${track.name}" now.`);
      await api.playNow({ trackUri: track.uri, deviceId, positionMs: 0 });
    },
    [deviceId]
  );

  const onQueue = useCallback(
    async (track) => {
      setStatusMessage(`Queued "${track.name}".`);
      await queueAndMaybeSeek({ trackUri: track.uri, trackName: track.name, deviceId, forceQueueOnly: true });
    },
    [deviceId, queueAndMaybeSeek]
  );

  const onQueueAndSeek = useCallback(
    async (track) => {
      setStatusMessage(`Queuing "${track.name}" and seeking to ${prefs.offsetSeconds}s…`);
      await queueAndMaybeSeek({
        trackUri: track.uri,
        trackName: track.name,
        deviceId,
        desiredOffsetMs: Math.round((prefs.offsetSeconds ?? 0) * 1000),
        seekDelayMs: Math.round((prefs.seekDelaySeconds ?? 0) * 1000),
        autoSeekEnabled: prefs.autoSeekEnabled,
        smoothTransitionEnabled: prefs.smoothTransitionEnabled,
        smoothFadeDurationMs: Math.round((prefs.smoothFadeSeconds ?? 2.5) * 1000)
      });
    },
    [deviceId, prefs, queueAndMaybeSeek]
  );

  return (
    <View style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search tracks, or paste a Spotify link"
        placeholderTextColor="rgba(255,255,255,0.4)"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {(statusMessage || transitionMessage) ? (
        <Text style={styles.status}>{statusMessage || transitionMessage}</Text>
      ) : null}
      <FlatList
        data={results}
        keyExtractor={(item) => item.uri}
        renderItem={({ item }) => (
          <TrackRow track={item} onPlayNow={onPlayNow} onQueue={onQueue} onQueueAndSeek={onQueueAndSeek} />
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 16
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 15
  },
  status: {
    color: "#b3b3b3",
    fontSize: 12,
    marginTop: 10
  },
  list: {
    paddingTop: 12,
    paddingBottom: 32
  }
});

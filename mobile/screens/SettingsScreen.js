import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View, Pressable } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useSession } from "../context/SessionContext";
import { getApiBaseUrl, setApiBaseUrl } from "../lib/apiBaseUrl";

function Field({ label, value, onChangeText, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={String(value ?? "")}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="rgba(255,255,255,0.35)"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { logout, sessionId } = useAuth();
  const { prefs, updatePrefs } = useSession();
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(getApiBaseUrl());

  useEffect(() => {
    setApiBaseUrlInput(getApiBaseUrl());
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Playback & Transitions</Text>

      <Field
        label="Seek offset (seconds)"
        value={prefs.offsetSeconds}
        keyboardType="numeric"
        onChangeText={(text) => updatePrefs({ offsetSeconds: Number(text) || 0 })}
      />
      <Field
        label="Smooth fade duration (seconds)"
        value={prefs.smoothFadeSeconds}
        keyboardType="numeric"
        onChangeText={(text) => updatePrefs({ smoothFadeSeconds: Number(text) || 0 })}
      />
      <Field
        label="Extra seek delay (seconds)"
        value={prefs.seekDelaySeconds}
        keyboardType="numeric"
        onChangeText={(text) => updatePrefs({ seekDelaySeconds: Number(text) || 0 })}
      />
      <Field
        label="Spotify Connect device ID (optional)"
        value={prefs.deviceId}
        onChangeText={(text) => updatePrefs({ deviceId: text })}
      />
      <Field
        label="Lyric sync offset (ms)"
        value={prefs.lyricOffsetMs}
        keyboardType="numeric"
        onChangeText={(text) => updatePrefs({ lyricOffsetMs: Number(text) || 0 })}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Auto-seek after queueing</Text>
        <Switch
          value={prefs.autoSeekEnabled}
          onValueChange={(value) => updatePrefs({ autoSeekEnabled: value })}
          trackColor={{ true: "#1ed760" }}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Smooth volume transition</Text>
        <Switch
          value={prefs.smoothTransitionEnabled}
          onValueChange={(value) => updatePrefs({ smoothTransitionEnabled: value })}
          trackColor={{ true: "#1ed760" }}
        />
      </View>

      <Text style={styles.sectionTitle}>Server</Text>
      <Field label="API base URL" value={apiBaseUrlInput} onChangeText={setApiBaseUrlInput} />
      <Pressable style={styles.saveButton} onPress={() => setApiBaseUrl(apiBaseUrlInput)}>
        <Text style={styles.saveButtonText}>Save server URL</Text>
      </Pressable>
      <Text style={styles.hint}>Your phone and computer must be on the same Wi-Fi network.</Text>

      <Text style={styles.sectionTitle}>Session</Text>
      <Text style={styles.sessionId}>{sessionId}</Text>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
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
  sectionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 10
  },
  field: {
    marginBottom: 12
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 4
  },
  fieldInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
    fontSize: 14
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8
  },
  switchLabel: {
    color: "#ffffff",
    fontSize: 14
  },
  saveButton: {
    backgroundColor: "rgba(30,215,96,0.2)",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4
  },
  saveButtonText: {
    color: "#1ed760",
    fontWeight: "700"
  },
  hint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginTop: 8
  },
  sessionId: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11
  },
  logoutButton: {
    marginTop: 32,
    backgroundColor: "rgba(255,80,80,0.15)",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center"
  },
  logoutButtonText: {
    color: "#f3727f",
    fontWeight: "700"
  }
});

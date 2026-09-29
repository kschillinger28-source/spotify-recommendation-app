import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login, isLoggingIn, loginError } = useAuth();
  const redirectUri = Linking.createURL("callback");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vibe DJ</Text>
      <Text style={styles.subtitle}>
        Connect your Spotify account to control playback and get live DJ-style recommendations.
      </Text>

      <Pressable style={styles.button} onPress={login} disabled={isLoggingIn}>
        {isLoggingIn ? (
          <ActivityIndicator color="#04120a" />
        ) : (
          <Text style={styles.buttonText}>Connect Spotify</Text>
        )}
      </Pressable>

      {loginError ? <Text style={styles.error}>{loginError}</Text> : null}

      <View style={styles.setupBox}>
        <Text style={styles.setupTitle}>First-time setup</Text>
        <Text style={styles.setupText}>
          Add this exact Redirect URI in your Spotify Developer Dashboard (app Settings → Redirect
          URIs) before connecting:
        </Text>
        <Text selectable style={styles.redirectUri}>
          {redirectUri}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 12
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 21
  },
  button: {
    backgroundColor: "#1ed760",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 220,
    alignItems: "center"
  },
  buttonText: {
    color: "#04120a",
    fontWeight: "700",
    fontSize: 15
  },
  error: {
    color: "#f3727f",
    marginTop: 20,
    textAlign: "center"
  },
  setupBox: {
    marginTop: 40,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    width: "100%"
  },
  setupTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6
  },
  setupText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8
  },
  redirectUri: {
    color: "#b3b3b3",
    fontSize: 12,
    fontWeight: "600"
  }
});

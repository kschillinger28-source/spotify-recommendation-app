import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./context/AuthContext";
import RootNavigator from "./navigation/RootNavigator";
import { loadApiBaseUrl } from "./lib/apiBaseUrl";

if (Platform.OS === "web") {
  // On web, the OAuth popup reloads this same app at the redirect URL. This
  // detects that case and hands the result back to the window that opened it.
  WebBrowser.maybeCompleteAuthSession();
}

export default function App() {
  const [isConfigReady, setIsConfigReady] = useState(false);

  useEffect(() => {
    loadApiBaseUrl().then(() => setIsConfigReady(true));
  }, []);

  if (!isConfigReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1ed760" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center"
  }
});

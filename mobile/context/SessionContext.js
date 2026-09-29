import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadPrefs, savePrefs } from "../lib/storage";
import * as api from "../lib/api";
import { useAuth } from "./AuthContext";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const { sessionId, isLoggedIn } = useAuth();
  const [prefs, setPrefsState] = useState(null);
  const [djSnapshot, setDjSnapshot] = useState(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadPrefs();
      setPrefsState(loaded);
    })();
  }, []);

  const updatePrefs = useCallback(async (partial) => {
    const next = await savePrefs(partial);
    setPrefsState(next);
    return next;
  }, []);

  const setRemixMode = useCallback(
    async (enabled) => {
      await updatePrefs({ remixModeEnabled: enabled });
      if (isLoggedIn && sessionId) {
        try {
          const result = await api.setRemixMode({ sessionId, remixModeEnabled: enabled });
          setDjSnapshot(result?.session ?? null);
        } catch {
          // Non-fatal — local preference still applies to the UI.
        }
      }
    },
    [isLoggedIn, sessionId, updatePrefs]
  );

  const setAutopilotEnabled = useCallback(
    (enabled) => updatePrefs({ autopilotEnabled: enabled }),
    [updatePrefs]
  );

  const setMoodLevel = useCallback((level) => updatePrefs({ moodLevel: level }), [updatePrefs]);
  const setNostalgiaSlider = useCallback(
    (level) => updatePrefs({ nostalgiaSlider: level }),
    [updatePrefs]
  );

  const value = useMemo(
    () => ({
      prefs,
      updatePrefs,
      setRemixMode,
      setAutopilotEnabled,
      setMoodLevel,
      setNostalgiaSlider,
      djSnapshot
    }),
    [prefs, updatePrefs, setRemixMode, setAutopilotEnabled, setMoodLevel, setNostalgiaSlider, djSnapshot]
  );

  if (!prefs) {
    return null;
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

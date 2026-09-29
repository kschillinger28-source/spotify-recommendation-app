import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as api from "../lib/api";
import { registerAuthAccessor } from "../lib/api";
import {
  clearStoredTokens,
  getOrCreateSessionId,
  getStoredTokens,
  setStoredTokens
} from "../lib/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [expiresAtMs, setExpiresAtMs] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [loginError, setLoginError] = useState(null);

  const refreshTokenRef = useRef(null);
  const refreshInFlightRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [tokens, storedSessionId] = await Promise.all([getStoredTokens(), getOrCreateSessionId()]);
      refreshTokenRef.current = tokens.refreshToken;
      setAccessToken(tokens.accessToken);
      setExpiresAtMs(tokens.expiresAtMs);
      setSessionId(storedSessionId);
      setIsLoading(false);
    })();
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    if (!refreshTokenRef.current) {
      return null;
    }

    refreshInFlightRef.current = (async () => {
      try {
        const result = await api.refreshAccessTokenRequest(refreshTokenRef.current);
        const tokens = result?.tokens;
        if (!tokens?.access_token) {
          return null;
        }
        const newExpiresAtMs = Date.now() + (Number(tokens.expires_in ?? 3600) * 1000) - 60000;
        if (tokens.refresh_token) {
          refreshTokenRef.current = tokens.refresh_token;
        }
        await setStoredTokens({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? refreshTokenRef.current,
          expiresAtMs: newExpiresAtMs
        });
        setAccessToken(tokens.access_token);
        setExpiresAtMs(newExpiresAtMs);
        return tokens.access_token;
      } catch {
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    return refreshInFlightRef.current;
  }, []);

  const ensureFreshToken = useCallback(async () => {
    if (accessToken && Date.now() < expiresAtMs) {
      return accessToken;
    }
    return refreshAccessToken();
  }, [accessToken, expiresAtMs, refreshAccessToken]);

  const login = useCallback(async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const redirectUri = Linking.createURL("callback");
      const { url, state } = await api.getMobileAuthorizeUrl(redirectUri);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);

      if (result.type !== "success" || !result.url) {
        if (result.type !== "cancel" && result.type !== "dismiss") {
          setLoginError("Spotify login did not complete. Please try again.");
        }
        return false;
      }

      const parsed = Linking.parse(result.url);
      const code = parsed.queryParams?.code;
      const returnedState = parsed.queryParams?.state;

      if (!code || !returnedState || returnedState !== state) {
        setLoginError("Spotify login response was invalid. Please try again.");
        return false;
      }

      const exchangeResult = await api.exchangeMobileCode({ code, state: returnedState });
      const tokens = exchangeResult?.tokens;
      if (!tokens?.access_token) {
        setLoginError("Could not complete Spotify login.");
        return false;
      }

      const newExpiresAtMs = Date.now() + (Number(tokens.expires_in ?? 3600) * 1000) - 60000;
      refreshTokenRef.current = tokens.refresh_token ?? null;
      await setStoredTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAtMs: newExpiresAtMs
      });
      setAccessToken(tokens.access_token);
      setExpiresAtMs(newExpiresAtMs);
      return true;
    } catch (error) {
      setLoginError(error?.message ?? "Could not connect to Spotify.");
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    refreshTokenRef.current = null;
    await clearStoredTokens();
    setAccessToken(null);
    setExpiresAtMs(0);
  }, []);

  useEffect(() => {
    registerAuthAccessor({
      getAccessToken: () => accessToken,
      getSessionId: () => sessionId,
      refreshAccessToken
    });
  }, [accessToken, sessionId, refreshAccessToken]);

  const value = useMemo(
    () => ({
      isLoading,
      isLoggingIn,
      isLoggedIn: Boolean(accessToken),
      accessToken,
      sessionId,
      loginError,
      login,
      logout,
      ensureFreshToken,
      refreshAccessToken
    }),
    [isLoading, isLoggingIn, accessToken, sessionId, loginError, login, logout, ensureFreshToken, refreshAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

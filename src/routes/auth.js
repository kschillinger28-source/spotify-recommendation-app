import crypto from "node:crypto";
import { Router } from "express";
import {
  addTrackToQueue,
  buildSpotifyAuthorizeUrl,
  exchangeCodeForTokens,
  fetchCurrentUserProfile,
  getCurrentPlayback,
  playTrackNow,
  searchSpotifyTracks,
  seekCurrentPlayback,
  refreshAccessToken
} from "../utils/spotify.js";

const router = Router();
const SPOTIFY_STATE_COOKIE = "spotify_oauth_state";

function normalizeTrackUri(input) {
  const rawInput = String(input ?? "").trim().replace(/^["']|["']$/g, "");
  if (!rawInput) {
    return null;
  }

  if (rawInput.startsWith("spotify:track:")) {
    const maybeCleanUri = rawInput.split("?")[0].split("#")[0];
    const id = maybeCleanUri.split(":")[2];
    if (id && /^[A-Za-z0-9]{22}$/.test(id)) {
      return `spotify:track:${id}`;
    }
    return null;
  }

  if (/^[A-Za-z0-9]{22}$/.test(rawInput)) {
    return `spotify:track:${rawInput}`;
  }

  try {
    const parsedUrl = new URL(rawInput);
    const host = parsedUrl.hostname.toLowerCase();
    const pathnameParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (
      (host === "open.spotify.com" || host.endsWith(".spotify.com")) &&
      pathnameParts[0] === "track" &&
      pathnameParts[1] &&
      /^[A-Za-z0-9]{22}$/.test(pathnameParts[1])
    ) {
      return `spotify:track:${pathnameParts[1]}`;
    }
  } catch {
    // Not a URL. Fall through and return null.
  }

  return null;
}

function getBearerTokenFromRequest(req) {
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
}

router.get("/spotify/login", (req, res) => {
  const state = crypto.randomBytes(24).toString("hex");
  const authorizeUrl = buildSpotifyAuthorizeUrl(state);

  res.cookie(SPOTIFY_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 10
  });

  return res.redirect(authorizeUrl);
});

router.get("/spotify/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const storedState = req.cookies[SPOTIFY_STATE_COOKIE];

  if (!code || !state) {
    return res.status(400).json({
      error: "Missing code or state from Spotify callback."
    });
  }

  if (!storedState || storedState !== state) {
    return res.status(400).json({
      error: "Invalid OAuth state. Try logging in again."
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(String(code));
    res.clearCookie(SPOTIFY_STATE_COOKIE);

    return res.status(200).json({
      message: "Spotify OAuth completed successfully.",
      tokens
    });
  } catch (error) {
    return res.status(502).json({
      error: "Spotify token exchange failed.",
      details: error.message
    });
  }
});

router.post("/spotify/refresh", async (req, res) => {
  const refreshToken = req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      error: "Missing refreshToken in request body."
    });
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    return res.status(200).json({
      message: "Access token refreshed.",
      tokens
    });
  } catch (error) {
    return res.status(502).json({
      error: "Spotify refresh token request failed.",
      details: error.message
    });
  }
});

router.get("/spotify/profile", async (req, res) => {
  const token = getBearerTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    const profile = await fetchCurrentUserProfile(token);
    return res.status(200).json(profile);
  } catch (error) {
    return res.status(502).json({
      error: "Could not fetch Spotify profile.",
      details: error.message
    });
  }
});

router.get("/spotify/search/tracks", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const query = String(req.query.q ?? "").trim();
  const limit = Number(req.query.limit ?? 10);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!query) {
    return res.status(400).json({
      error: "Missing query parameter q."
    });
  }

  try {
    const tracks = await searchSpotifyTracks(token, query, limit);
    return res.status(200).json({
      query,
      count: tracks.length,
      tracks
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not search Spotify tracks.",
      details: error.message
    });
  }
});

router.post("/spotify/player/queue", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const rawTrackInput = req.body?.trackUri ?? req.body?.uri;
  const trackUri = normalizeTrackUri(rawTrackInput);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!rawTrackInput || typeof rawTrackInput !== "string") {
    return res.status(400).json({
      error: "Missing trackUri in request body."
    });
  }

  if (!trackUri) {
    return res.status(400).json({
      error: "trackUri must be a valid Spotify track URI, URL, or 22-char track ID."
    });
  }

  try {
    await addTrackToQueue(token, trackUri, deviceId);
    return res.status(200).json({
      message: "Track added to queue.",
      trackUri
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not add track to Spotify queue.",
      details: error.message
    });
  }
});

router.get("/spotify/player/current", async (req, res) => {
  const token = getBearerTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  try {
    const playback = await getCurrentPlayback(token);
    if (!playback) {
      return res.status(200).json({
        hasActivePlayback: false,
        playback: null
      });
    }

    return res.status(200).json({
      hasActivePlayback: true,
      playback
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not fetch current Spotify playback state.",
      details: error.message
    });
  }
});

router.put("/spotify/player/seek", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const positionMs = Number(req.body?.positionMs);
  const deviceId = req.body?.deviceId;

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!Number.isFinite(positionMs) || positionMs < 0) {
    return res.status(400).json({
      error: "positionMs must be a non-negative number."
    });
  }

  try {
    await seekCurrentPlayback(token, Math.round(positionMs), deviceId);
    return res.status(200).json({
      message: "Seek command sent.",
      positionMs: Math.round(positionMs)
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not seek current Spotify playback.",
      details: error.message
    });
  }
});

router.put("/spotify/player/play-now", async (req, res) => {
  const token = getBearerTokenFromRequest(req);
  const rawTrackInput = req.body?.trackUri ?? req.body?.uri;
  const trackUri = normalizeTrackUri(rawTrackInput);
  const deviceId = req.body?.deviceId;
  const positionMs = Number(req.body?.positionMs ?? 0);

  if (!token) {
    return res.status(401).json({
      error: "Missing Bearer access token."
    });
  }

  if (!rawTrackInput || typeof rawTrackInput !== "string") {
    return res.status(400).json({
      error: "Missing trackUri in request body."
    });
  }

  if (!trackUri) {
    return res.status(400).json({
      error: "trackUri must be a valid Spotify track URI, URL, or 22-char track ID."
    });
  }

  if (!Number.isFinite(positionMs) || positionMs < 0) {
    return res.status(400).json({
      error: "positionMs must be a non-negative number."
    });
  }

  try {
    const result = await playTrackNow(
      token,
      trackUri,
      deviceId,
      Math.round(positionMs)
    );
    return res.status(200).json({
      message: "Playback started immediately.",
      ...result
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not start Spotify playback.",
      details: error.message
    });
  }
});

export default router;

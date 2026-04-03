const ACCESS_TOKEN_KEY = "spotify_helper_access_token";
const REFRESH_TOKEN_KEY = "spotify_helper_refresh_token";
const PROVIDER_KEY = "spotify_helper_provider";
const TRACK_INPUT_KEY = "spotify_helper_track_input";
const SEARCH_QUERY_KEY = "spotify_helper_search_query";
const OFFSET_SECONDS_KEY = "spotify_helper_offset_seconds";
const DEVICE_ID_KEY = "spotify_helper_device_id";
const AUTO_SEEK_ENABLED_KEY = "spotify_helper_auto_seek_enabled";
const SEEK_DELAY_SECONDS_KEY = "spotify_helper_seek_delay_seconds";
const PENDING_QUEUE_KEY = "spotify_helper_pending_queue_target";

const elements = {
  provider: document.getElementById("provider"),
  providerStatus: document.getElementById("providerStatus"),
  accessTokenLabel: document.getElementById("accessTokenLabel"),
  accessToken: document.getElementById("accessToken"),
  refreshToken: document.getElementById("refreshToken"),
  refreshTokenButton: document.getElementById("refreshTokenButton"),
  trackUri: document.getElementById("trackUri"),
  trackSearchQuery: document.getElementById("trackSearchQuery"),
  searchTracksButton: document.getElementById("searchTracksButton"),
  searchResults: document.getElementById("searchResults"),
  offsetSeconds: document.getElementById("offsetSeconds"),
  autoSeekEnabled: document.getElementById("autoSeekEnabled"),
  seekDelaySeconds: document.getElementById("seekDelaySeconds"),
  deviceId: document.getElementById("deviceId"),
  quickPlayNowButton: document.getElementById("quickPlayNowButton"),
  quickQueueOnlyButton: document.getElementById("quickQueueOnlyButton"),
  quickQueueAndSeekButton: document.getElementById("quickQueueAndSeekButton"),
  statusLog: document.getElementById("statusLog"),
  fallbackCard: document.getElementById("fallbackCard"),
  fallbackReason: document.getElementById("fallbackReason"),
  fallbackTimestamp: document.getElementById("fallbackTimestamp")
};

let pollingIntervalId = null;
let pollInFlight = false;
let searchInFlight = false;
let searchDebounceTimerId = null;
let pendingSearchAfterInFlight = false;
let refreshInFlightPromise = null;

const PROVIDER_DISPLAY_NAMES = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple_music: "Apple Music"
};

function getSelectedProvider() {
  return elements.provider.value;
}

function isProviderSupported(provider) {
  return provider === "spotify";
}

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

function setTrackInput(trackUri) {
  elements.trackUri.value = trackUri;
  saveInputsToLocalStorage();
}

function setActionButtonsDisabled(disabled) {
  elements.quickPlayNowButton.disabled = disabled;
  elements.quickQueueOnlyButton.disabled = disabled;
  elements.quickQueueAndSeekButton.disabled = disabled;
}

function logStatus(message) {
  const item = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  item.textContent = `[${time}] ${message}`;
  elements.statusLog.prepend(item);
}

function formatDurationMs(durationMs) {
  const totalSeconds = Math.floor((Number(durationMs) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function clearSearchResults(message = "") {
  elements.searchResults.innerHTML = "";
  if (message) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = message;
    elements.searchResults.appendChild(empty);
  }
}

function renderSearchResults(tracks) {
  elements.searchResults.innerHTML = "";

  if (!tracks.length) {
    clearSearchResults("No tracks found. Try a different song/artist phrase.");
    return;
  }

  tracks.forEach((track) => {
    const card = document.createElement("div");
    card.className = "result-item";

    const title = document.createElement("div");
    title.className = "result-title";
    title.textContent = track.name;

    const meta = document.createElement("div");
    meta.className = "result-meta";
    const artists = (track.artistNames ?? []).join(", ");
    const album = track.albumName || "Unknown album";
    meta.textContent = `${artists} • ${album} • ${formatDurationMs(track.durationMs)}`;

    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.textContent = "Use This Track";
    useButton.addEventListener("click", () => {
      setTrackInput(track.uri);
      logStatus(`Selected "${track.name}" (${track.uri}).`);
    });

    const playNowButton = document.createElement("button");
    playNowButton.type = "button";
    playNowButton.textContent = "Play Now";
    playNowButton.addEventListener("click", async () => {
      setTrackInput(track.uri);
      logStatus(`Play-now from search result: ${track.name}.`);
      await handlePlayNowClick(track.uri);
    });

    const queueButton = document.createElement("button");
    queueButton.type = "button";
    queueButton.textContent = "Queue";
    queueButton.addEventListener("click", async () => {
      setTrackInput(track.uri);
      logStatus(`Queue-only from search result: ${track.name}.`);
      await handleQueueAction({ forceQueueOnly: true, trackUriOverride: track.uri });
    });

    const queueSeekButton = document.createElement("button");
    queueSeekButton.type = "button";
    queueSeekButton.textContent = "Queue + Seek";
    queueSeekButton.addEventListener("click", async () => {
      setTrackInput(track.uri);
      logStatus(`Queue+seek from search result: ${track.name}.`);
      await handleQueueAction({ forceQueueOnly: false, trackUriOverride: track.uri });
    });

    const actions = document.createElement("div");
    actions.className = "result-actions";
    actions.appendChild(useButton);
    actions.appendChild(playNowButton);
    actions.appendChild(queueButton);
    actions.appendChild(queueSeekButton);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(actions);
    elements.searchResults.appendChild(card);
  });
}

function clearSearchUiAfterQueue() {
  elements.trackSearchQuery.value = "";
  clearSearchResults();
  saveInputsToLocalStorage();
}

function formatMs(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseNonNegativeNumber(rawValue, fieldName, defaultValue = 0) {
  const text = String(rawValue ?? "").trim();
  if (text === "") {
    return defaultValue;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  return parsed;
}

function showFallback(reason, desiredOffsetMs) {
  elements.fallbackReason.textContent = reason;
  elements.fallbackTimestamp.textContent = formatMs(desiredOffsetMs);
  elements.fallbackCard.classList.remove("hidden");
}

function hideFallback() {
  elements.fallbackReason.textContent = "";
  elements.fallbackTimestamp.textContent = "0:00";
  elements.fallbackCard.classList.add("hidden");
}

function saveInputsToLocalStorage() {
  localStorage.setItem(PROVIDER_KEY, getSelectedProvider());
  localStorage.setItem(ACCESS_TOKEN_KEY, elements.accessToken.value.trim());
  localStorage.setItem(REFRESH_TOKEN_KEY, elements.refreshToken.value.trim());
  localStorage.setItem(TRACK_INPUT_KEY, elements.trackUri.value.trim());
  localStorage.setItem(SEARCH_QUERY_KEY, elements.trackSearchQuery.value.trim());
  localStorage.setItem(OFFSET_SECONDS_KEY, elements.offsetSeconds.value.trim());
  localStorage.setItem(DEVICE_ID_KEY, elements.deviceId.value.trim());
  localStorage.setItem(
    AUTO_SEEK_ENABLED_KEY,
    elements.autoSeekEnabled.checked ? "true" : "false"
  );
  localStorage.setItem(
    SEEK_DELAY_SECONDS_KEY,
    elements.seekDelaySeconds.value.trim()
  );
}

function loadInputsFromLocalStorage() {
  const savedProvider = localStorage.getItem(PROVIDER_KEY) ?? "spotify";
  if (PROVIDER_DISPLAY_NAMES[savedProvider]) {
    elements.provider.value = savedProvider;
  }
  elements.accessToken.value = localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
  elements.refreshToken.value = localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";
  elements.trackUri.value = localStorage.getItem(TRACK_INPUT_KEY) ?? "";
  elements.trackSearchQuery.value = localStorage.getItem(SEARCH_QUERY_KEY) ?? "";
  elements.offsetSeconds.value = localStorage.getItem(OFFSET_SECONDS_KEY) ?? "";
  elements.deviceId.value = localStorage.getItem(DEVICE_ID_KEY) ?? "";
  elements.autoSeekEnabled.checked =
    (localStorage.getItem(AUTO_SEEK_ENABLED_KEY) ?? "true") !== "false";
  elements.seekDelaySeconds.value =
    localStorage.getItem(SEEK_DELAY_SECONDS_KEY) ?? "";
}

function applyTokensFromUrlIfPresent() {
  const url = new URL(window.location.href);
  const searchAccessToken = url.searchParams.get("access_token");
  const searchRefreshToken = url.searchParams.get("refresh_token");
  const hashParams = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
  );
  const hashAccessToken = hashParams.get("access_token");
  const hashRefreshToken = hashParams.get("refresh_token");

  const accessToken = hashAccessToken || searchAccessToken;
  const refreshToken = hashRefreshToken || searchRefreshToken;

  if (!accessToken && !refreshToken) {
    return;
  }

  if (accessToken) {
    elements.accessToken.value = accessToken;
  }
  if (refreshToken) {
    elements.refreshToken.value = refreshToken;
  }
  saveInputsToLocalStorage();

  // Clean sensitive tokens from URL after importing.
  url.searchParams.delete("access_token");
  url.searchParams.delete("refresh_token");
  if (hashAccessToken || hashRefreshToken) {
    url.hash = "";
  }
  const cleanUrl =
    url.pathname +
    (url.search ? url.search : "") +
    (url.hash ? url.hash : "");
  window.history.replaceState({}, "", cleanUrl);
}

function updateAutoSeekUi() {
  const providerSupported = isProviderSupported(getSelectedProvider());
  const enabled = elements.autoSeekEnabled.checked;
  elements.autoSeekEnabled.disabled = !providerSupported;
  elements.offsetSeconds.disabled = !providerSupported || !enabled;
  elements.seekDelaySeconds.disabled = !providerSupported || !enabled;

  if (!providerSupported) {
    setActionButtonsDisabled(true);
    elements.quickQueueAndSeekButton.textContent = "Queue + Auto Seek";
    return;
  }

  setActionButtonsDisabled(false);
  const queueSeekLabel = enabled
    ? "Queue + Auto Seek"
    : "Queue Song (No Seek)";
  elements.quickQueueAndSeekButton.textContent = queueSeekLabel;
}

function updateProviderUi() {
  const provider = getSelectedProvider();
  const providerSupported = isProviderSupported(provider);
  const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;

  elements.accessTokenLabel.textContent = `${providerName} Access Token`;

  if (providerSupported) {
    elements.providerStatus.textContent =
      "Spotify support is active. SoundCloud and Apple Music UI is staged for future integration.";
    elements.providerStatus.style.color = "#9ff6cd";
  } else {
    elements.providerStatus.textContent = `${providerName} integration is not wired yet. Use Spotify to run queue and seek today.`;
    elements.providerStatus.style.color = "#ffd3a1";
    stopPolling();
    clearPendingQueueTarget();
  }

  elements.accessToken.disabled = !providerSupported;
  elements.refreshToken.disabled = !providerSupported;
  elements.refreshTokenButton.disabled = !providerSupported;
  elements.trackUri.disabled = !providerSupported;
  elements.trackSearchQuery.disabled = !providerSupported;
  elements.searchTracksButton.disabled = !providerSupported;
  elements.deviceId.disabled = !providerSupported;

  if (!providerSupported) {
    clearSearchResults(
      `${providerName} search is coming soon. Switch to Spotify for live search.`
    );
  }

  updateAutoSeekUi();
}

function getPendingQueueTarget() {
  const raw = localStorage.getItem(PENDING_QUEUE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(PENDING_QUEUE_KEY);
    return null;
  }
}

function setPendingQueueTarget(data) {
  localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(data));
}

function clearPendingQueueTarget() {
  localStorage.removeItem(PENDING_QUEUE_KEY);
}

function isTokenExpiredMessage(message) {
  const value = String(message ?? "").toLowerCase();
  return value.includes("token expired") || value.includes("access token expired");
}

function applyFreshTokens(tokens, oldRefreshToken = "") {
  const newAccessToken = tokens?.access_token;
  if (!newAccessToken) {
    throw new Error("Token refresh succeeded but no new access token was returned.");
  }

  elements.accessToken.value = newAccessToken;
  elements.refreshToken.value = tokens?.refresh_token || oldRefreshToken;
  saveInputsToLocalStorage();
  return newAccessToken;
}

async function refreshAccessTokenIfPossible({ silent = false } = {}) {
  const refreshToken = elements.refreshToken.value.trim();
  if (!refreshToken) {
    throw new Error(
      "Access token expired. Add your refresh token once to enable auto-refresh."
    );
  }

  if (refreshInFlightPromise) {
    return refreshInFlightPromise;
  }

  refreshInFlightPromise = (async () => {
    const response = await fetch("/auth/spotify/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refreshToken
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.details || payload?.error || "Could not refresh token";
      throw new Error(message);
    }

    const nextAccessToken = applyFreshTokens(payload?.tokens ?? {}, refreshToken);
    if (!silent) {
      logStatus("Access token refreshed automatically.");
    }

    return nextAccessToken;
  })();

  try {
    return await refreshInFlightPromise;
  } finally {
    refreshInFlightPromise = null;
  }
}

async function apiRequest(path, method, accessToken, body, options = {}) {
  const { allowAutoRefresh = true } = options;
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.details || payload?.error || "Request failed";
    if (allowAutoRefresh && isTokenExpiredMessage(message)) {
      const refreshedAccessToken = await refreshAccessTokenIfPossible();
      return apiRequest(path, method, refreshedAccessToken, body, {
        allowAutoRefresh: false
      });
    }
    throw new Error(message);
  }

  return payload;
}

function scheduleAutoSearch() {
  if (searchDebounceTimerId !== null) {
    window.clearTimeout(searchDebounceTimerId);
    searchDebounceTimerId = null;
  }

  const query = elements.trackSearchQuery.value.trim();
  if (!query) {
    clearSearchResults("Search by song, artist, or words, then pick a result.");
    return;
  }

  if (query.length < 2) {
    clearSearchResults("Keep typing to search...");
    return;
  }

  searchDebounceTimerId = window.setTimeout(() => {
    searchTracks({ source: "auto" });
  }, 350);
}

async function searchTracks({ source = "manual" } = {}) {
  if (searchInFlight) {
    pendingSearchAfterInFlight = true;
    if (source === "manual") {
      logStatus("Search in progress. Running another search right after.");
    }
    return;
  }

  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
    clearSearchResults(`${providerName} search is coming soon.`);
    return;
  }

  const accessToken = elements.accessToken.value.trim();
  const query = elements.trackSearchQuery.value.trim();

  if (!accessToken) {
    clearSearchResults("Add your access token first, then search.");
    return;
  }

  if (!query) {
    clearSearchResults("Type a song name, artist, or keyword to search.");
    return;
  }

  searchInFlight = true;
  elements.searchTracksButton.disabled = true;
  clearSearchResults("Searching tracks...");

  try {
    const params = new URLSearchParams({
      q: query,
      limit: "10"
    });
    const payload = await apiRequest(
      `/auth/spotify/search/tracks?${params.toString()}`,
      "GET",
      accessToken
    );

    renderSearchResults(payload?.tracks ?? []);
    logStatus(
      `Search "${query}" returned ${payload?.tracks?.length ?? 0} track(s).`
    );
  } catch (error) {
    clearSearchResults(`Search failed: ${error.message}`);
    logStatus(`Search failed: ${error.message}`);
  } finally {
    searchInFlight = false;
    if (pendingSearchAfterInFlight) {
      pendingSearchAfterInFlight = false;
      searchTracks({ source: "auto" });
      return;
    }
    updateProviderUi();
  }
}

function stopPolling() {
  if (pollingIntervalId !== null) {
    window.clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
}

async function attemptSeekAndVerify(pendingTarget, accessToken) {
  if (pendingTarget.seekDelayMs > 0) {
    logStatus(
      `Track is current. Waiting ${Math.round(
        pendingTarget.seekDelayMs / 1000
      )}s before seek.`
    );
    await new Promise((resolve) =>
      window.setTimeout(resolve, pendingTarget.seekDelayMs)
    );
  }

  logStatus(
    `Attempting seek to ${formatMs(pendingTarget.desiredOffsetMs)}.`
  );

  await apiRequest("/auth/spotify/player/seek", "PUT", accessToken, {
    positionMs: pendingTarget.desiredOffsetMs,
    deviceId: pendingTarget.deviceId ?? undefined
  });

  await new Promise((resolve) => window.setTimeout(resolve, 1200));

  const playbackState = await apiRequest(
    "/auth/spotify/player/current",
    "GET",
    accessToken
  );

  const currentUri = playbackState?.playback?.item?.uri;
  const progressMs = playbackState?.playback?.progress_ms;
  const maxAllowedDriftMs = 3000;

  if (currentUri !== pendingTarget.trackUri) {
    throw new Error("Queued track changed before seek could be verified.");
  }

  if (!Number.isFinite(progressMs)) {
    throw new Error("Spotify did not return playback progress for verification.");
  }

  const drift = Math.abs(progressMs - pendingTarget.desiredOffsetMs);
  if (drift > maxAllowedDriftMs) {
    throw new Error(
      `Seek verification drift was ${Math.round(drift / 1000)}s (${formatMs(progressMs)} reported).`
    );
  }

  logStatus(`Seek verified near ${formatMs(pendingTarget.desiredOffsetMs)}.`);
  clearPendingQueueTarget();
  hideFallback();
  stopPolling();
}

function startPollingForQueuedTrack(pendingTarget, accessToken) {
  stopPolling();

  let attempts = 0;
  const maxAttempts = 75;

  pollingIntervalId = window.setInterval(async () => {
    if (pollInFlight) {
      return;
    }
    pollInFlight = true;

    try {
      attempts += 1;
      const playbackState = await apiRequest(
        "/auth/spotify/player/current",
        "GET",
        accessToken
      );

      if (!playbackState?.hasActivePlayback || !playbackState?.playback) {
        if (attempts % 5 === 0) {
          logStatus("Waiting for active Spotify playback device...");
        }
      } else {
        const currentUri = playbackState.playback?.item?.uri;
        if (attempts % 4 === 0) {
          const name = playbackState.playback?.item?.name ?? "unknown";
          logStatus(`Current playback: ${name}`);
        }

        if (
          pendingTarget.mustSeeDifferentTrackFirst &&
          !pendingTarget.seenDifferentTrackYet
        ) {
          if (currentUri && currentUri !== pendingTarget.trackUri) {
            pendingTarget.seenDifferentTrackYet = true;
            setPendingQueueTarget(pendingTarget);
            logStatus(
              "Detected track change away from target. Waiting for target to come back from queue."
            );
          }
          return;
        }

        if (currentUri === pendingTarget.trackUri) {
          await attemptSeekAndVerify(pendingTarget, accessToken);
        }
      }

      if (attempts >= maxAttempts && pollingIntervalId !== null) {
        stopPolling();
        showFallback(
          "Timed out waiting for queued track to become current playback.",
          pendingTarget.desiredOffsetMs
        );
        logStatus("Timed out before queued track became current.");
      }
    } catch (error) {
      stopPolling();
      showFallback(
        `Auto-seek could not be verified: ${error.message}`,
        pendingTarget.desiredOffsetMs
      );
      logStatus(`Auto-seek fallback: ${error.message}`);
    } finally {
      pollInFlight = false;
    }
  }, 2000);
}

async function handleQueueAction({
  forceQueueOnly = false,
  trackUriOverride = null
} = {}) {
  hideFallback();
  saveInputsToLocalStorage();
  setActionButtonsDisabled(true);

  try {
    const provider = getSelectedProvider();
    if (!isProviderSupported(provider)) {
      const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
      throw new Error(
        `${providerName} support is coming soon. Switch provider to Spotify for now.`
      );
    }

    const autoSeekEnabled = elements.autoSeekEnabled.checked;
    const shouldAutoSeek = !forceQueueOnly && autoSeekEnabled;
    const accessToken = elements.accessToken.value.trim();
    const rawTrackInput = String(
      trackUriOverride ?? elements.trackUri.value
    ).trim();
    const trackUri = normalizeTrackUri(rawTrackInput);
    const deviceId = elements.deviceId.value.trim();

    if (!accessToken) {
      throw new Error("Please provide an access token.");
    }

    if (!trackUri) {
      throw new Error(
        "Track input must be a Spotify track URI, track URL, or 22-char track ID."
      );
    }

    if (rawTrackInput !== trackUri) {
      setTrackInput(trackUri);
      logStatus(`Normalized track input to ${trackUri}.`);
    }

    let desiredOffsetMs = 0;
    let seekDelayMs = 0;

    if (shouldAutoSeek) {
      const offsetSeconds = parseNonNegativeNumber(
        elements.offsetSeconds.value,
        "Offset",
        0
      );
      const seekDelaySeconds = parseNonNegativeNumber(
        elements.seekDelaySeconds.value,
        "Seek delay",
        0
      );

      desiredOffsetMs = Math.round(offsetSeconds * 1000);
      seekDelayMs = Math.round(seekDelaySeconds * 1000);
    }

    await apiRequest("/auth/spotify/player/queue", "POST", accessToken, {
      trackUri,
      deviceId: deviceId || undefined
    });
    clearSearchUiAfterQueue();
    logStatus("Search results cleared after queueing track.");

    if (!shouldAutoSeek) {
      clearPendingQueueTarget();
      stopPolling();
      hideFallback();
      logStatus(
        `Queued ${trackUri}. No auto-seek, so Spotify native transition behavior is preserved.`
      );
      return;
    }

    const pendingTarget = {
      trackUri,
      desiredOffsetMs,
      seekDelayMs,
      deviceId: deviceId || null,
      mustSeeDifferentTrackFirst: false,
      seenDifferentTrackYet: false,
      createdAtMs: Date.now()
    };

    try {
      const playbackState = await apiRequest(
        "/auth/spotify/player/current",
        "GET",
        accessToken
      );
      const currentUri = playbackState?.playback?.item?.uri;
      if (currentUri === trackUri) {
        pendingTarget.mustSeeDifferentTrackFirst = true;
        logStatus(
          "Target song is currently playing. Waiting for a different song first so we do not re-seek the current playback."
        );
      }
    } catch (error) {
      logStatus(
        `Could not pre-check current song before watcher start: ${error.message}`
      );
    }

    setPendingQueueTarget(pendingTarget);
    logStatus(`Queued ${trackUri}. Watching for track to become current...`);
    startPollingForQueuedTrack(pendingTarget, accessToken);
  } catch (error) {
    logStatus(`Could not start queue flow: ${error.message}`);
    const pendingTarget = getPendingQueueTarget();
    showFallback(
      `Queue/seek setup failed: ${error.message}`,
      pendingTarget?.desiredOffsetMs ?? 0
    );
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handleQueueOnlyClick() {
  await handleQueueAction({ forceQueueOnly: true });
}

async function handleQueueAndSeekClick() {
  await handleQueueAction({ forceQueueOnly: false });
}

async function handlePlayNowClick(trackUriOverride = null) {
  hideFallback();
  saveInputsToLocalStorage();
  setActionButtonsDisabled(true);

  try {
    const provider = getSelectedProvider();
    if (!isProviderSupported(provider)) {
      const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
      throw new Error(
        `${providerName} support is coming soon. Switch provider to Spotify for now.`
      );
    }

    const accessToken = elements.accessToken.value.trim();
    const rawTrackInput = String(
      trackUriOverride ?? elements.trackUri.value
    ).trim();
    const trackUri = normalizeTrackUri(rawTrackInput);
    const deviceId = elements.deviceId.value.trim();

    if (!accessToken) {
      throw new Error("Please provide an access token.");
    }

    if (!trackUri) {
      throw new Error(
        "Track input must be a Spotify track URI, track URL, or 22-char track ID."
      );
    }

    if (rawTrackInput !== trackUri) {
      setTrackInput(trackUri);
      logStatus(`Normalized track input to ${trackUri}.`);
    }

    const offsetSeconds = parseNonNegativeNumber(
      elements.offsetSeconds.value,
      "Offset",
      0
    );
    const positionMs = Math.round(offsetSeconds * 1000);

    await apiRequest("/auth/spotify/player/play-now", "PUT", accessToken, {
      trackUri,
      deviceId: deviceId || undefined,
      positionMs
    });

    stopPolling();
    clearPendingQueueTarget();
    clearSearchUiAfterQueue();
    hideFallback();
    logStatus(`Playing now: ${trackUri} at ${formatMs(positionMs)}.`);
  } catch (error) {
    const parsedOffset = Number(elements.offsetSeconds.value);
    const positionMs =
      Number.isFinite(parsedOffset) && parsedOffset >= 0
        ? Math.round(parsedOffset * 1000)
        : 0;
    logStatus(`Could not start play-now flow: ${error.message}`);
    showFallback(`Play-now failed: ${error.message}`, positionMs);
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handleManualRefreshTokenClick() {
  elements.refreshTokenButton.disabled = true;
  try {
    await refreshAccessTokenIfPossible({ silent: true });
    logStatus("Access token refreshed.");
  } catch (error) {
    logStatus(`Could not refresh access token: ${error.message}`);
    showFallback(`Token refresh failed: ${error.message}`, 0);
  } finally {
    updateProviderUi();
  }
}

function bindEvents() {
  elements.provider.addEventListener("change", () => {
    updateProviderUi();
    saveInputsToLocalStorage();
  });
  elements.quickPlayNowButton.addEventListener("click", handlePlayNowClick);
  elements.quickQueueOnlyButton.addEventListener("click", handleQueueOnlyClick);
  elements.quickQueueAndSeekButton.addEventListener("click", handleQueueAndSeekClick);
  elements.refreshTokenButton.addEventListener("click", handleManualRefreshTokenClick);
  elements.searchTracksButton.addEventListener("click", () =>
    searchTracks({ source: "manual" })
  );
  elements.accessToken.addEventListener("change", saveInputsToLocalStorage);
  elements.refreshToken.addEventListener("change", saveInputsToLocalStorage);
  elements.trackUri.addEventListener("change", saveInputsToLocalStorage);
  elements.trackSearchQuery.addEventListener("change", saveInputsToLocalStorage);
  elements.trackSearchQuery.addEventListener("input", () => {
    saveInputsToLocalStorage();
    scheduleAutoSearch();
  });
  elements.trackSearchQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchTracks({ source: "manual" });
    }
  });
  elements.offsetSeconds.addEventListener("change", saveInputsToLocalStorage);
  elements.seekDelaySeconds.addEventListener("change", saveInputsToLocalStorage);
  elements.deviceId.addEventListener("change", saveInputsToLocalStorage);
  elements.autoSeekEnabled.addEventListener("change", () => {
    updateAutoSeekUi();
    saveInputsToLocalStorage();
  });
}

function maybeResumePendingQueueWatcher() {
  const pendingTarget = getPendingQueueTarget();
  const accessToken = elements.accessToken.value.trim();
  if (!pendingTarget || !accessToken) {
    return;
  }

  logStatus("Resuming pending queue watcher from local storage.");
  startPollingForQueuedTrack(pendingTarget, accessToken);
}

function init() {
  loadInputsFromLocalStorage();
  applyTokensFromUrlIfPresent();
  updateProviderUi();
  updateAutoSeekUi();
  clearSearchResults("Search by song, artist, or words, then pick a result.");
  bindEvents();
  maybeResumePendingQueueWatcher();
}

init();

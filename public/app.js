const ACCESS_TOKEN_KEY = "spotify_helper_access_token";
const REFRESH_TOKEN_KEY = "spotify_helper_refresh_token";
const PROVIDER_KEY = "spotify_helper_provider";
const TRACK_INPUT_KEY = "spotify_helper_track_input";
const SEARCH_QUERY_KEY = "spotify_helper_search_query";
const OFFSET_SECONDS_KEY = "spotify_helper_offset_seconds";
const DEVICE_ID_KEY = "spotify_helper_device_id";
const AUTO_SEEK_ENABLED_KEY = "spotify_helper_auto_seek_enabled";
const SEEK_DELAY_SECONDS_KEY = "spotify_helper_seek_delay_seconds";
const SMOOTH_TRANSITION_ENABLED_KEY = "spotify_helper_smooth_transition_enabled";
const SMOOTH_FADE_SECONDS_KEY = "spotify_helper_smooth_fade_seconds";
const PENDING_QUEUE_KEY = "spotify_helper_pending_queue_target";

const elements = {
  provider: document.getElementById("provider"),
  providerStatus: document.getElementById("providerStatus"),
  accessTokenLabel: document.getElementById("accessTokenLabel"),
  connectSpotifyButton: document.getElementById("connectSpotifyButton"),
  accessToken: document.getElementById("accessToken"),
  refreshToken: document.getElementById("refreshToken"),
  refreshTokenButton: document.getElementById("refreshTokenButton"),
  trackUri: document.getElementById("trackUri"),
  queueFromUriButton: document.getElementById("queueFromUriButton"),
  trackSearchQuery: document.getElementById("trackSearchQuery"),
  searchTracksButton: document.getElementById("searchTracksButton"),
  searchResults: document.getElementById("searchResults"),
  offsetSeconds: document.getElementById("offsetSeconds"),
  autoSeekEnabled: document.getElementById("autoSeekEnabled"),
  seekDelaySeconds: document.getElementById("seekDelaySeconds"),
  smoothTransitionEnabled: document.getElementById("smoothTransitionEnabled"),
  smoothFadeSeconds: document.getElementById("smoothFadeSeconds"),
  deviceId: document.getElementById("deviceId"),
  quickPreviousButton: document.getElementById("quickPreviousButton"),
  quickPauseResumeButton: document.getElementById("quickPauseResumeButton"),
  quickNextButton: document.getElementById("quickNextButton"),
  quickPlayNowButton: document.getElementById("quickPlayNowButton"),
  quickQueueOnlyButton: document.getElementById("quickQueueOnlyButton"),
  quickQueueAndSeekButton: document.getElementById("quickQueueAndSeekButton"),
  statusLog: document.getElementById("statusLog"),
  fallbackCard: document.getElementById("fallbackCard"),
  fallbackReason: document.getElementById("fallbackReason"),
  fallbackTimestamp: document.getElementById("fallbackTimestamp"),
  nowPlayingAlbumArt: document.getElementById("nowPlayingAlbumArt"),
  nowPlayingTitle: document.getElementById("nowPlayingTitle"),
  nowPlayingArtist: document.getElementById("nowPlayingArtist"),
  nowPlayingAlbum: document.getElementById("nowPlayingAlbum"),
  nowPlayingProgressBar: document.getElementById("nowPlayingProgressBar"),
  nowPlayingProgressText: document.getElementById("nowPlayingProgressText"),
  nowPlayingRemainingText: document.getElementById("nowPlayingRemainingText"),
  refreshNowPlayingButton: document.getElementById("refreshNowPlayingButton"),
  generateRecommendationButton: document.getElementById("generateRecommendationButton"),
  recommendationStatus: document.getElementById("recommendationStatus"),
  recommendationScoreNote: document.getElementById("recommendationScoreNote"),
  recommendationPrimary: document.getElementById("recommendationPrimary"),
  recommendationAlbumArt: document.getElementById("recommendationAlbumArt"),
  recommendationTitle: document.getElementById("recommendationTitle"),
  recommendationArtist: document.getElementById("recommendationArtist"),
  recommendationPlan: document.getElementById("recommendationPlan"),
  recommendationScoreChip: document.getElementById("recommendationScoreChip"),
  recommendationOffsetChip: document.getElementById("recommendationOffsetChip"),
  recommendationCandidates: document.getElementById("recommendationCandidates"),
  useRecommendationButton: document.getElementById("useRecommendationButton"),
  queueRecommendationButton: document.getElementById("queueRecommendationButton"),
  queueTopCandidatesButton: document.getElementById("queueTopCandidatesButton")
};

let pollingIntervalId = null;
let pollInFlight = false;
let searchInFlight = false;
let searchDebounceTimerId = null;
let pendingSearchAfterInFlight = false;
let refreshInFlightPromise = null;
let nowPlayingIntervalId = null;
let nowPlayingInFlight = false;
let recommendationInFlight = false;
let latestRecommendationPlan = null;
const NOW_PLAYING_POLL_INTERVAL_MS = 1000;

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
  const rawInput = String(input ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!rawInput) {
    return null;
  }

  const idPattern = /^[A-Za-z0-9]{22}$/;
  const spotifyUriMatch = rawInput.match(/spotify:track:([A-Za-z0-9]{22})/i);
  if (spotifyUriMatch?.[1] && idPattern.test(spotifyUriMatch[1])) {
    return `spotify:track:${spotifyUriMatch[1]}`;
  }

  if (idPattern.test(rawInput)) {
    return `spotify:track:${rawInput}`;
  }

  try {
    const parsedUrl = new URL(rawInput);
    const host = parsedUrl.hostname.toLowerCase();
    const pathnameParts = parsedUrl.pathname.split("/").filter(Boolean);
    const trackIdInPath = parsedUrl.pathname.match(
      /\/track\/([A-Za-z0-9]{22})(?:[/?#]|$)/i
    )?.[1];
    if (
      (host === "open.spotify.com" || host.endsWith(".spotify.com")) &&
      ((pathnameParts[0] === "track" &&
        pathnameParts[1] &&
        idPattern.test(pathnameParts[1])) ||
        (trackIdInPath && idPattern.test(trackIdInPath)))
    ) {
      return `spotify:track:${pathnameParts[1] ?? trackIdInPath}`;
    }
  } catch {
    // Not a URL. Fall through and return null.
  }

  const spotifyUrlMatch = rawInput.match(
    /open\.spotify\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?track\/([A-Za-z0-9]{22})/i
  );
  if (spotifyUrlMatch?.[1] && idPattern.test(spotifyUrlMatch[1])) {
    return `spotify:track:${spotifyUrlMatch[1]}`;
  }

  return null;
}

function setTrackInput(trackUri) {
  elements.trackUri.value = trackUri;
  saveInputsToLocalStorage();
}

function setActionButtonsDisabled(disabled) {
  elements.queueFromUriButton.disabled = disabled;
  elements.quickPreviousButton.disabled = disabled;
  elements.quickPauseResumeButton.disabled = disabled;
  elements.quickNextButton.disabled = disabled;
  elements.quickPlayNowButton.disabled = disabled;
  elements.quickQueueOnlyButton.disabled = disabled;
  elements.quickQueueAndSeekButton.disabled = disabled;
}

function setPauseResumeButtonLabel(isPlaying) {
  elements.quickPauseResumeButton.textContent = isPlaying ? "Pause" : "Resume";
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
      logStatus(
        `Selected "${track.name}" (${track.uri}) into Track URI. Queue from URI or use Quick Actions.`
      );
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

function setAlbumArt(imageElement, imageUrl, altText) {
  if (imageUrl) {
    imageElement.src = imageUrl;
    imageElement.alt = altText;
    return;
  }

  imageElement.removeAttribute("src");
  imageElement.alt = "Album art unavailable";
}

function renderNowPlayingEmpty(message = "No active playback") {
  setAlbumArt(elements.nowPlayingAlbumArt, null, "No album art");
  elements.nowPlayingTitle.textContent = message;
  elements.nowPlayingArtist.textContent = "Start a song in Spotify to load details.";
  elements.nowPlayingAlbum.textContent = "";
  elements.nowPlayingProgressBar.style.width = "0%";
  elements.nowPlayingProgressText.textContent = "0:00 / 0:00";
  elements.nowPlayingRemainingText.textContent = "remaining 0:00";
  setPauseResumeButtonLabel(false);
}

function renderNowPlaying(playbackPayload) {
  const playback = playbackPayload?.playback;
  const item = playback?.item;

  if (!playbackPayload?.hasActivePlayback || !item) {
    renderNowPlayingEmpty();
    return;
  }

  const artistText = (item.artists ?? []).map((artist) => artist.name).join(", ");
  const durationMs = Number(item.duration_ms) || 0;
  const progressMs = Math.max(0, Number(playback.progress_ms) || 0);
  const remainingMs = Math.max(0, durationMs - progressMs);
  const isPlaying = Boolean(playback?.is_playing);
  const progressPercent =
    durationMs > 0 ? Math.max(0, Math.min(100, (progressMs / durationMs) * 100)) : 0;

  setAlbumArt(
    elements.nowPlayingAlbumArt,
    item.album?.images?.[0]?.url ?? item.album?.images?.[1]?.url ?? null,
    `${item.name} album art`
  );
  elements.nowPlayingTitle.textContent = item.name || "Unknown track";
  elements.nowPlayingArtist.textContent = artistText || "Unknown artist";
  elements.nowPlayingAlbum.textContent = item.album?.name
    ? `Album: ${item.album.name}`
    : "";
  elements.nowPlayingProgressBar.style.width = `${progressPercent.toFixed(1)}%`;
  elements.nowPlayingProgressText.textContent = `${formatMs(progressMs)} / ${formatMs(
    durationMs
  )}`;
  elements.nowPlayingRemainingText.textContent = isPlaying
    ? `remaining ${formatMs(remainingMs)}`
    : `paused at ${formatMs(progressMs)}`;
  setPauseResumeButtonLabel(isPlaying);
}

async function refreshNowPlaying({ silent = false } = {}) {
  if (nowPlayingInFlight) {
    return;
  }

  nowPlayingInFlight = true;

  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    renderNowPlayingEmpty("Now playing is available for Spotify only.");
    nowPlayingInFlight = false;
    return;
  }

  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) {
    renderNowPlayingEmpty("Add access token to load now playing.");
    nowPlayingInFlight = false;
    return;
  }

  try {
    const payload = await apiRequest(
      "/auth/spotify/player/current",
      "GET",
      accessToken
    );
    renderNowPlaying(payload);
  } catch (error) {
    if (!silent) {
      logStatus(`Could not refresh now playing: ${error.message}`);
    }
    renderNowPlayingEmpty("Could not load now playing.");
  } finally {
    nowPlayingInFlight = false;
  }
}

function stopNowPlayingPolling() {
  if (nowPlayingIntervalId !== null) {
    window.clearInterval(nowPlayingIntervalId);
    nowPlayingIntervalId = null;
  }
}

function startNowPlayingPolling() {
  stopNowPlayingPolling();
  nowPlayingIntervalId = window.setInterval(() => {
    refreshNowPlaying({ silent: true });
  }, NOW_PLAYING_POLL_INTERVAL_MS);
}

function updateRecommendationButtons() {
  const providerSupported = isProviderSupported(getSelectedProvider());
  const hasRecommendation = Boolean(latestRecommendationPlan?.selectedCandidate?.uri);
  const hasTopCandidates = (latestRecommendationPlan?.topCandidates?.length ?? 0) > 0;
  elements.generateRecommendationButton.disabled =
    !providerSupported || recommendationInFlight;
  elements.useRecommendationButton.disabled = !providerSupported || !hasRecommendation;
  elements.queueRecommendationButton.disabled = !providerSupported || !hasRecommendation;
  elements.queueTopCandidatesButton.disabled = !providerSupported || !hasTopCandidates;
}

function formatSignedScorePart(value) {
  const numeric = Math.round(Number(value) || 0);
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function clearRecommendationUi(message) {
  latestRecommendationPlan = null;
  elements.recommendationPrimary.classList.add("hidden");
  elements.recommendationCandidates.innerHTML = "";
  elements.recommendationStatus.textContent = message;
  elements.recommendationScoreNote.textContent =
    "Score is a heuristic fit (0-100). Higher means better transition fit based on artist continuity, popularity fit, duration fit, BPM/energy compatibility, explicit match, source confidence, and repeat-avoidance.";
  updateRecommendationButtons();
}

function renderRecommendationPlan(plan) {
  latestRecommendationPlan = plan;

  const selected = plan?.selectedCandidate;
  const transitionPlan = plan?.transitionPlan;
  const entryPoint = plan?.entryPoint;
  if (!selected || !transitionPlan || !entryPoint) {
    clearRecommendationUi("Recommendation response was missing expected fields.");
    return;
  }

  setAlbumArt(
    elements.recommendationAlbumArt,
    selected.albumImageUrl ?? null,
    `${selected.name} album art`
  );
  elements.recommendationTitle.textContent = selected.name || "Unknown track";
  elements.recommendationArtist.textContent =
    (selected.artistNames ?? []).join(", ") || "Unknown artist";
  elements.recommendationPlan.textContent = transitionPlan.strategy;
  elements.recommendationScoreChip.textContent = `Score ${selected.score}/100`;
  elements.recommendationOffsetChip.textContent = `Start ${entryPoint.recommendedOffsetSeconds}s`;
  elements.recommendationPrimary.classList.remove("hidden");

  elements.recommendationStatus.textContent =
    `Scanned ${plan?.candidateSelection?.totalCandidates ?? 0} candidates. ` +
    `Best fit: ${selected.name}.`;

  const scoreBreakdown = selected?.scoreBreakdown;
  if (scoreBreakdown) {
    elements.recommendationScoreNote.textContent =
      `Why this score: artist ${formatSignedScorePart(scoreBreakdown.artistContinuity)}, ` +
      `popularity ${formatSignedScorePart(scoreBreakdown.popularityFit)}, ` +
      `duration ${formatSignedScorePart(scoreBreakdown.durationFit)}, ` +
      `bpm ${formatSignedScorePart(scoreBreakdown.bpmFit)}, ` +
      `energy ${formatSignedScorePart(scoreBreakdown.energyFit)}, ` +
      `explicit ${formatSignedScorePart(scoreBreakdown.explicitFit)}, ` +
      `source ${formatSignedScorePart(scoreBreakdown.sourceFit)}, ` +
      `repeat ${formatSignedScorePart(scoreBreakdown.repeatPenalty)}.`;
  } else {
    elements.recommendationScoreNote.textContent =
      "Score is a heuristic fit (0-100). Higher means better transition fit.";
  }

  elements.recommendationCandidates.innerHTML = "";
  (plan.topCandidates ?? []).forEach((candidate, index) => {
    const item = document.createElement("div");
    item.className = "candidate-item";
    item.textContent = `${index + 1}. ${candidate.name} - ${(
      candidate.artistNames ?? []
    ).join(", ")} | score ${candidate.score}/100 | source ${candidate.source}`;
    elements.recommendationCandidates.appendChild(item);
  });

  updateRecommendationButtons();
}

function getTopRecommendationQueuePlan(limit = 3) {
  const candidates = latestRecommendationPlan?.topCandidates ?? [];
  const queuePlan = [];
  const seenUris = new Set();

  for (const candidate of candidates) {
    if (!candidate?.uri || seenUris.has(candidate.uri)) {
      continue;
    }
    seenUris.add(candidate.uri);
    queuePlan.push({
      uri: candidate.uri,
      name: candidate.name ?? candidate.uri
    });
    if (queuePlan.length >= limit) {
      break;
    }
  }

  return queuePlan;
}

function applyRecommendationToInputs() {
  const selected = latestRecommendationPlan?.selectedCandidate;
  const transitionPlan = latestRecommendationPlan?.transitionPlan;
  if (!selected || !transitionPlan) {
    throw new Error("Generate a recommendation first.");
  }

  setTrackInput(selected.uri);
  elements.offsetSeconds.value = String(transitionPlan.recommendedOffsetSeconds);
  elements.seekDelaySeconds.value = String(
    transitionPlan.recommendedSeekDelaySeconds
  );
  elements.autoSeekEnabled.checked = true;
  updateAutoSeekUi();
  saveInputsToLocalStorage();
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
  localStorage.setItem(
    SMOOTH_TRANSITION_ENABLED_KEY,
    elements.smoothTransitionEnabled.checked ? "true" : "false"
  );
  localStorage.setItem(
    SMOOTH_FADE_SECONDS_KEY,
    elements.smoothFadeSeconds.value.trim()
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
  elements.smoothTransitionEnabled.checked =
    (localStorage.getItem(SMOOTH_TRANSITION_ENABLED_KEY) ?? "true") !== "false";
  elements.smoothFadeSeconds.value =
    localStorage.getItem(SMOOTH_FADE_SECONDS_KEY) ?? "1.2";
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
  const hashAuthStatus = hashParams.get("auth");
  const hashAuthError = hashParams.get("auth_error");

  const accessToken = hashAccessToken || searchAccessToken;
  const refreshToken = hashRefreshToken || searchRefreshToken;

  if (!accessToken && !refreshToken && !hashAuthStatus && !hashAuthError) {
    return;
  }

  if (accessToken) {
    elements.accessToken.value = accessToken;
  }
  if (refreshToken) {
    elements.refreshToken.value = refreshToken;
  }
  saveInputsToLocalStorage();
  if (hashAuthError) {
    logStatus(`Spotify connect failed: ${hashAuthError}`);
  } else if (hashAuthStatus === "success" && (accessToken || refreshToken)) {
    logStatus("Spotify connected. Tokens imported automatically.");
  }

  // Clean sensitive tokens from URL after importing.
  url.searchParams.delete("access_token");
  url.searchParams.delete("refresh_token");
  if (hashAccessToken || hashRefreshToken || hashAuthStatus || hashAuthError) {
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
  elements.smoothTransitionEnabled.disabled = !providerSupported || !enabled;
  elements.smoothFadeSeconds.disabled =
    !providerSupported || !enabled || !elements.smoothTransitionEnabled.checked;

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
  elements.connectSpotifyButton.disabled = !providerSupported;
  elements.refreshToken.disabled = !providerSupported;
  elements.refreshTokenButton.disabled = !providerSupported;
  elements.trackUri.disabled = !providerSupported;
  elements.queueFromUriButton.disabled = !providerSupported;
  elements.trackSearchQuery.disabled = !providerSupported;
  elements.searchTracksButton.disabled = !providerSupported;
  elements.deviceId.disabled = !providerSupported;
  elements.refreshNowPlayingButton.disabled = !providerSupported;

  if (!providerSupported) {
    clearSearchResults(
      `${providerName} search is coming soon. Switch to Spotify for live search.`
    );
    clearRecommendationUi(`${providerName} recommendation engine is coming soon.`);
    renderNowPlayingEmpty("Now playing is available for Spotify only.");
    stopNowPlayingPolling();
  } else {
    if (!latestRecommendationPlan && elements.recommendationStatus.textContent.trim() === "") {
      elements.recommendationStatus.textContent =
        "Generate a plan to score the next best track.";
    }
    startNowPlayingPolling();
  }

  updateAutoSeekUi();
  updateRecommendationButtons();
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

function sanitizeLooseTokenString(rawValue) {
  return String(rawValue ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function looksLikeOpaqueToken(value) {
  return /^[A-Za-z0-9._-]{20,}$/.test(value);
}

function extractTokenFromLooseInput(rawValue, tokenKey) {
  const normalized = sanitizeLooseTokenString(rawValue);
  if (!normalized) {
    return "";
  }

  if (looksLikeOpaqueToken(normalized) && !normalized.includes("{")) {
    return normalized;
  }

  const patternsByKey = {
    access_token: [
      /["']access_token["']\s*:\s*["']([^"']+)["']/i,
      /["']accessToken["']\s*:\s*["']([^"']+)["']/i,
      /\baccess_token=([^&\s]+)/i
    ],
    refresh_token: [
      /["']refresh_token["']\s*:\s*["']([^"']+)["']/i,
      /["']refreshToken["']\s*:\s*["']([^"']+)["']/i,
      /\brefresh_token=([^&\s]+)/i
    ]
  };

  const keyPatterns = patternsByKey[tokenKey] ?? [];
  for (const pattern of keyPatterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const decoded = sanitizeLooseTokenString(
      (() => {
        try {
          return decodeURIComponent(match[1]);
        } catch {
          return match[1];
        }
      })()
    );
    if (looksLikeOpaqueToken(decoded)) {
      return decoded;
    }
  }

  try {
    const parsed = JSON.parse(normalized);
    const accessCandidates = [
      parsed?.access_token,
      parsed?.accessToken,
      parsed?.tokens?.access_token,
      parsed?.tokens?.accessToken
    ];
    const refreshCandidates = [
      parsed?.refresh_token,
      parsed?.refreshToken,
      parsed?.tokens?.refresh_token,
      parsed?.tokens?.refreshToken
    ];
    const candidates = tokenKey === "access_token" ? accessCandidates : refreshCandidates;
    for (const candidate of candidates) {
      const cleaned = sanitizeLooseTokenString(candidate);
      if (looksLikeOpaqueToken(cleaned)) {
        return cleaned;
      }
    }
  } catch {
    // Ignore parse errors and return empty below.
  }

  return "";
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
  const rawRefreshInput = elements.refreshToken.value;
  const refreshToken = extractTokenFromLooseInput(
    rawRefreshInput,
    "refresh_token"
  );
  if (!refreshToken) {
    throw new Error(
      "Access token expired. Add your refresh token once to enable auto-refresh."
    );
  }

  if (elements.refreshToken.value.trim() !== refreshToken) {
    elements.refreshToken.value = refreshToken;
    const maybeAccessFromSamePaste = extractTokenFromLooseInput(
      rawRefreshInput,
      "access_token"
    );
    if (maybeAccessFromSamePaste && !elements.accessToken.value.trim()) {
      elements.accessToken.value = maybeAccessFromSamePaste;
    }
    saveInputsToLocalStorage();
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

async function waitMs(durationMs) {
  await new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

async function setPlaybackVolume(accessToken, volumePercent, deviceId) {
  await apiRequest("/auth/spotify/player/volume", "PUT", accessToken, {
    volumePercent,
    deviceId: deviceId || undefined
  });
}

async function fadeVolume({
  accessToken,
  fromVolumePercent,
  toVolumePercent,
  durationMs,
  deviceId
}) {
  const steps = Math.max(2, Math.min(8, Math.round(durationMs / 220)));
  const stepDelayMs = Math.max(40, Math.round(durationMs / steps));

  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    const nextVolume = Math.round(
      fromVolumePercent + (toVolumePercent - fromVolumePercent) * ratio
    );
    await setPlaybackVolume(accessToken, nextVolume, deviceId);
    if (step < steps) {
      await waitMs(stepDelayMs);
    }
  }
}

async function runSmoothDjSeekTransition(
  pendingTarget,
  accessToken,
  detectionPlaybackState
) {
  const detectedVolume = Number(
    detectionPlaybackState?.playback?.device?.volume_percent
  );
  const baseVolume = Number.isFinite(detectedVolume)
    ? Math.max(12, Math.min(100, Math.round(detectedVolume)))
    : 65;
  const fadeDurationMs = Math.max(
    200,
    Math.min(6000, Number(pendingTarget.smoothFadeDurationMs) || 1200)
  );
  const fadeHalfMs = Math.max(120, Math.round(fadeDurationMs / 2));
  const dippedVolume = Math.max(8, Math.round(baseVolume * 0.35));

  logStatus(
    `Applying DJ fade transition (${Math.round(
      fadeDurationMs / 1000
    )}s total) before seek.`
  );

  try {
    await fadeVolume({
      accessToken,
      fromVolumePercent: baseVolume,
      toVolumePercent: dippedVolume,
      durationMs: fadeHalfMs,
      deviceId: pendingTarget.deviceId
    });
  } catch (error) {
    logStatus(`Fade-down skipped: ${error.message}`);
  }

  await apiRequest("/auth/spotify/player/seek", "PUT", accessToken, {
    positionMs: pendingTarget.desiredOffsetMs,
    deviceId: pendingTarget.deviceId ?? undefined
  });

  await waitMs(220);

  try {
    await fadeVolume({
      accessToken,
      fromVolumePercent: dippedVolume,
      toVolumePercent: baseVolume,
      durationMs: fadeHalfMs,
      deviceId: pendingTarget.deviceId
    });
  } catch (error) {
    logStatus(`Fade-up skipped: ${error.message}`);
  }
}

async function attemptSeekAndVerify(
  pendingTarget,
  accessToken,
  detectionPlaybackState = null
) {
  if (pendingTarget.seekDelayMs > 0) {
    logStatus(
      `Track is current. Waiting ${Math.round(
        pendingTarget.seekDelayMs / 1000
      )}s before seek.`
    );
    await waitMs(pendingTarget.seekDelayMs);
  }

  logStatus(
    `Attempting seek to ${formatMs(pendingTarget.desiredOffsetMs)}.`
  );

  if (pendingTarget.smoothTransitionEnabled) {
    await runSmoothDjSeekTransition(
      pendingTarget,
      accessToken,
      detectionPlaybackState
    );
  } else {
    await apiRequest("/auth/spotify/player/seek", "PUT", accessToken, {
      positionMs: pendingTarget.desiredOffsetMs,
      deviceId: pendingTarget.deviceId ?? undefined
    });
  }

  await waitMs(1200);

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
  let lastPlaybackStatusKey = "";
  let hasLoggedWaitingForDevice = false;

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
        if (!hasLoggedWaitingForDevice) {
          logStatus("Waiting for active Spotify playback device...");
          hasLoggedWaitingForDevice = true;
          lastPlaybackStatusKey = "";
        }
      } else {
        hasLoggedWaitingForDevice = false;
        const currentUri = playbackState.playback?.item?.uri;
        const isPlaying = Boolean(playbackState.playback?.is_playing);
        const statusKey = `${currentUri ?? "none"}:${isPlaying ? "playing" : "paused"}`;
        if (statusKey !== lastPlaybackStatusKey) {
          const name = playbackState.playback?.item?.name ?? "unknown";
          if (isPlaying) {
            logStatus(`Playback changed: now playing ${name}.`);
          } else {
            logStatus(`Playback changed: ${name} is selected but paused.`);
          }
          lastPlaybackStatusKey = statusKey;
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
          await attemptSeekAndVerify(pendingTarget, accessToken, playbackState);
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
    let smoothTransitionEnabled = false;
    let smoothFadeDurationMs = 1200;

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
      const smoothFadeSeconds = parseNonNegativeNumber(
        elements.smoothFadeSeconds.value,
        "Fade duration",
        1.2
      );

      desiredOffsetMs = Math.round(offsetSeconds * 1000);
      seekDelayMs = Math.round(seekDelaySeconds * 1000);
      smoothTransitionEnabled = elements.smoothTransitionEnabled.checked;
      smoothFadeDurationMs = Math.round(
        Math.max(200, Math.min(6000, smoothFadeSeconds * 1000))
      );
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
      smoothTransitionEnabled,
      smoothFadeDurationMs,
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

async function handleQueueFromUriClick() {
  await handleQueueAction({ forceQueueOnly: true });
}

async function handleQueueAndSeekClick() {
  await handleQueueAction({ forceQueueOnly: false });
}

function getQuickTransportContext() {
  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
    throw new Error(
      `${providerName} support is coming soon. Switch provider to Spotify for now.`
    );
  }

  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) {
    throw new Error("Please provide an access token.");
  }

  const deviceId = elements.deviceId.value.trim();
  return {
    accessToken,
    deviceId
  };
}

async function handleQuickPauseResumeClick() {
  setActionButtonsDisabled(true);
  try {
    const { accessToken, deviceId } = getQuickTransportContext();
    const playbackState = await apiRequest(
      "/auth/spotify/player/current",
      "GET",
      accessToken
    );
    const isPlaying = Boolean(
      playbackState?.hasActivePlayback && playbackState?.playback?.is_playing
    );

    await apiRequest(
      isPlaying ? "/auth/spotify/player/pause" : "/auth/spotify/player/resume",
      "PUT",
      accessToken,
      {
        deviceId: deviceId || undefined
      }
    );
    logStatus(isPlaying ? "Paused playback." : "Resumed playback.");
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    logStatus(`Could not toggle pause/resume: ${error.message}`);
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handleQuickNextClick() {
  setActionButtonsDisabled(true);
  try {
    const { accessToken, deviceId } = getQuickTransportContext();
    await apiRequest("/auth/spotify/player/next", "POST", accessToken, {
      deviceId: deviceId || undefined
    });
    logStatus("Skipped to next track.");
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    logStatus(`Could not skip to next track: ${error.message}`);
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handleQuickPreviousClick() {
  setActionButtonsDisabled(true);
  try {
    const { accessToken, deviceId } = getQuickTransportContext();
    await apiRequest("/auth/spotify/player/previous", "POST", accessToken, {
      deviceId: deviceId || undefined
    });
    logStatus("Went to previous track.");
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    logStatus(`Could not go to previous track: ${error.message}`);
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
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
    const rawRefreshInput = elements.refreshToken.value;
    const normalizedRefreshToken = extractTokenFromLooseInput(
      rawRefreshInput,
      "refresh_token"
    );
    if (normalizedRefreshToken && elements.refreshToken.value.trim() !== normalizedRefreshToken) {
      elements.refreshToken.value = normalizedRefreshToken;
      const maybeAccessFromSamePaste = extractTokenFromLooseInput(
        rawRefreshInput,
        "access_token"
      );
      if (maybeAccessFromSamePaste && !elements.accessToken.value.trim()) {
        elements.accessToken.value = maybeAccessFromSamePaste;
      }
      saveInputsToLocalStorage();
    }
    await refreshAccessTokenIfPossible({ silent: true });
    logStatus("Access token refreshed.");
  } catch (error) {
    logStatus(`Could not refresh access token: ${error.message}`);
    showFallback(`Token refresh failed: ${error.message}`, 0);
  } finally {
    updateProviderUi();
  }
}

async function handleRefreshNowPlayingClick() {
  elements.refreshNowPlayingButton.disabled = true;
  try {
    await refreshNowPlaying({ silent: false });
  } finally {
    updateProviderUi();
  }
}

function handleConnectSpotifyClick() {
  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
    logStatus(`${providerName} connect is coming soon. Switch to Spotify for now.`);
    return;
  }

  window.location.assign("/auth/spotify/login");
}

async function handleGenerateRecommendationClick() {
  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
    clearRecommendationUi(`${providerName} recommendation engine is coming soon.`);
    return;
  }

  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) {
    clearRecommendationUi("Add your access token first, then generate a plan.");
    return;
  }

  recommendationInFlight = true;
  updateRecommendationButtons();
  elements.recommendationStatus.textContent = "Generating recommendation plan...";

  try {
    const plan = await apiRequest(
      "/auth/spotify/recommend/next",
      "GET",
      accessToken
    );
    renderRecommendationPlan(plan);
    logStatus(
      `Recommendation generated: ${plan?.selectedCandidate?.name ?? "unknown track"}`
    );
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    clearRecommendationUi(`Recommendation failed: ${error.message}`);
    logStatus(`Recommendation failed: ${error.message}`);
  } finally {
    recommendationInFlight = false;
    updateRecommendationButtons();
  }
}

function handleUseRecommendationClick() {
  try {
    applyRecommendationToInputs();
    logStatus("Applied recommendation to queue inputs.");
  } catch (error) {
    logStatus(`Could not apply recommendation: ${error.message}`);
  }
}

async function handleQueueRecommendationClick() {
  try {
    applyRecommendationToInputs();
    await handleQueueAction({
      forceQueueOnly: false,
      trackUriOverride: latestRecommendationPlan?.selectedCandidate?.uri ?? null
    });
  } catch (error) {
    logStatus(`Could not queue recommendation: ${error.message}`);
  }
}

async function handleQueueTopCandidatesClick() {
  try {
    const provider = getSelectedProvider();
    if (!isProviderSupported(provider)) {
      const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
      throw new Error(
        `${providerName} support is coming soon. Switch provider to Spotify for now.`
      );
    }

    const accessToken = elements.accessToken.value.trim();
    if (!accessToken) {
      throw new Error("Please provide an access token.");
    }

    const deviceId = elements.deviceId.value.trim();
    const queuePlan = getTopRecommendationQueuePlan(3);
    if (!queuePlan.length) {
      throw new Error("Generate recommendations first.");
    }

    setActionButtonsDisabled(true);
    recommendationInFlight = true;
    updateRecommendationButtons();

    for (const item of queuePlan) {
      await apiRequest("/auth/spotify/player/queue", "POST", accessToken, {
        trackUri: item.uri,
        deviceId: deviceId || undefined
      });
    }

    const queueNames = queuePlan.map((item) => item.name).join(", ");
    logStatus(`Queued top ${queuePlan.length} recommendations: ${queueNames}.`);
    elements.recommendationStatus.textContent =
      `Queued top ${queuePlan.length} scored tracks in order.`;
  } catch (error) {
    logStatus(`Could not queue top recommendations: ${error.message}`);
  } finally {
    recommendationInFlight = false;
    setActionButtonsDisabled(false);
    updateRecommendationButtons();
  }
}

function bindEvents() {
  elements.provider.addEventListener("change", () => {
    updateProviderUi();
    saveInputsToLocalStorage();
  });
  elements.quickPreviousButton.addEventListener("click", handleQuickPreviousClick);
  elements.quickPauseResumeButton.addEventListener(
    "click",
    handleQuickPauseResumeClick
  );
  elements.quickNextButton.addEventListener("click", handleQuickNextClick);
  elements.connectSpotifyButton.addEventListener("click", handleConnectSpotifyClick);
  elements.quickPlayNowButton.addEventListener("click", handlePlayNowClick);
  elements.queueFromUriButton.addEventListener("click", handleQueueFromUriClick);
  elements.quickQueueOnlyButton.addEventListener("click", handleQueueOnlyClick);
  elements.quickQueueAndSeekButton.addEventListener("click", handleQueueAndSeekClick);
  elements.refreshTokenButton.addEventListener("click", handleManualRefreshTokenClick);
  elements.refreshNowPlayingButton.addEventListener("click", handleRefreshNowPlayingClick);
  elements.generateRecommendationButton.addEventListener(
    "click",
    handleGenerateRecommendationClick
  );
  elements.useRecommendationButton.addEventListener(
    "click",
    handleUseRecommendationClick
  );
  elements.queueRecommendationButton.addEventListener(
    "click",
    handleQueueRecommendationClick
  );
  elements.queueTopCandidatesButton.addEventListener(
    "click",
    handleQueueTopCandidatesClick
  );
  elements.searchTracksButton.addEventListener("click", () =>
    searchTracks({ source: "manual" })
  );
  elements.accessToken.addEventListener("change", () => {
    saveInputsToLocalStorage();
    refreshNowPlaying({ silent: true });
  });
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
  elements.smoothFadeSeconds.addEventListener("change", saveInputsToLocalStorage);
  elements.deviceId.addEventListener("change", saveInputsToLocalStorage);
  elements.autoSeekEnabled.addEventListener("change", () => {
    updateAutoSeekUi();
    saveInputsToLocalStorage();
  });
  elements.smoothTransitionEnabled.addEventListener("change", () => {
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
  clearRecommendationUi("Generate a plan to score the next best track.");
  renderNowPlayingEmpty();
  clearSearchResults("Search by song, artist, or words, then pick a result.");
  bindEvents();
  maybeResumePendingQueueWatcher();
  refreshNowPlaying({ silent: true });
  startNowPlayingPolling();
}

init();

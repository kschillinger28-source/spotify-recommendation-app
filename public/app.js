import { detectProviderFromUrl, getProviderStrategy } from "./providers/musicProvider.js";
import { UniversalPlayer } from "./universalPlayer.js";
import {
  showLoadingSpinner,
  hideLoadingSpinner,
  enhanceTabNavigation,
  enhanceFormInputs,
  updateTabAriaAttributes,
  saveScrollPosition,
  restoreScrollPosition
} from "./app-helpers.js";

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
const DJ_SESSION_ID_KEY = "spotify_helper_dj_session_id";
const DJ_REMIX_MODE_KEY = "spotify_helper_dj_remix_mode";
const DJ_AUTOPILOT_ENABLED_KEY = "spotify_helper_dj_autopilot_enabled";
const ADVANCED_SETTINGS_VISIBLE_KEY = "spotify_helper_advanced_settings_visible";
const CONTEXT_MOOD_LEVEL_KEY = "spotify_helper_context_mood_level";
const CONTEXT_NOSTALGIA_SLIDER_KEY = "spotify_helper_context_nostalgia_slider";
const LYRIC_OFFSET_MS_KEY = "spotify_helper_lyric_offset_ms";
const ACTIVE_APP_VIEW_KEY = "spotify_helper_active_app_view";
const LISTENER_AGE_KEY = "spotify_helper_listener_age";
const LISTENER_GENDER_KEY = "spotify_helper_listener_gender";
const USE_LOCATION_ENABLED_KEY = "spotify_helper_use_location_enabled";
const USE_LOCATION_COORDS_KEY = "spotify_helper_use_location_coords";
const APP_VIEW_NAMES = ["player", "vibe", "settings"];

const elements = {
  nowPlayingCard: document.getElementById("nowPlayingCard"),
  provider: document.getElementById("provider"),
  providerStatus: document.getElementById("providerStatus"),
  connectSpotifyHint: document.getElementById("connectSpotifyHint"),
  accessTokenLabel: document.getElementById("accessTokenLabel"),
  connectSpotifyButton: document.getElementById("connectSpotifyButton"),
  connectSpotifyButtonLabel: document.getElementById("connectSpotifyButtonLabel"),
  connectSoundcloudButton: document.getElementById("connectSoundcloudButton"),
  connectAppleMusicButton: document.getElementById("connectAppleMusicButton"),
  connectYoutubeMusicButton: document.getElementById("connectYoutubeMusicButton"),
  connectTidalButton: document.getElementById("connectTidalButton"),
  useLocationButton: document.getElementById("useLocationButton"),
  locationStatus: document.getElementById("locationStatus"),
  listenerAge: document.getElementById("listenerAge"),
  listenerGender: document.getElementById("listenerGender"),
  accessToken: document.getElementById("accessToken"),
  refreshToken: document.getElementById("refreshToken"),
  refreshTokenButton: document.getElementById("refreshTokenButton"),
  trackUri: document.getElementById("trackUri"),
  queueFromUriButton: document.getElementById("queueFromUriButton"),
  trackSearchQuery: document.getElementById("trackSearchQuery"),
  searchTracksButton: document.getElementById("searchTracksButton"),
  searchInlineStatus: document.getElementById("searchInlineStatus"),
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
  actionInlineStatus: document.getElementById("actionInlineStatus"),
  statusLog: document.getElementById("statusLog"),
  fallbackCard: document.getElementById("fallbackCard"),
  fallbackReason: document.getElementById("fallbackReason"),
  fallbackTimestamp: document.getElementById("fallbackTimestamp"),
  nowPlayingAlbumArt: document.getElementById("nowPlayingAlbumArt"),
  nowPlayingHeroBg: document.getElementById("nowPlayingHeroBg"),
  nowPlayingVisualizer: document.getElementById("nowPlayingVisualizer"),
  nowPlayingHeroAlbumArt: document.getElementById("nowPlayingHeroAlbumArt"),
  nowPlayingHeroArtPlaceholder: document.getElementById("nowPlayingHeroArtPlaceholder"),
  nowPlayingTitleHero: document.getElementById("nowPlayingTitleHero"),
  nowPlayingArtistHero: document.getElementById("nowPlayingArtistHero"),
  nowPlayingAlbumHero: document.getElementById("nowPlayingAlbumHero"),
  nowPlayingLyricsViewport: document.getElementById("nowPlayingLyricsViewport"),
  nowPlayingLyricsStage: document.getElementById("nowPlayingLyricsStage"),
  nowPlayingLyricCurrent: document.getElementById("nowPlayingLyricCurrent"),
  nowPlayingLyricsTransition: document.getElementById("nowPlayingLyricsTransition"),
  lyricOffsetMs: document.getElementById("lyricOffsetMs"),
  nowPlayingTitle: document.getElementById("nowPlayingTitle"),
  nowPlayingArtist: document.getElementById("nowPlayingArtist"),
  nowPlayingAlbum: document.getElementById("nowPlayingAlbum"),
  nowPlayingProgressBar: document.getElementById("nowPlayingProgressBar"),
  nowPlayingProgressText: document.getElementById("nowPlayingProgressText"),
  nowPlayingRemainingText: document.getElementById("nowPlayingRemainingText"),
  refreshNowPlayingButton: document.getElementById("refreshNowPlayingButton"),
  generateRecommendationButton: document.getElementById("generateRecommendationButton"),
  environmentContextBadges: document.getElementById("environmentContextBadges"),
  contextMoodLevel: document.getElementById("contextMoodLevel"),
  contextMoodLabel: document.getElementById("contextMoodLabel"),
  contextNostalgiaSlider: document.getElementById("contextNostalgiaSlider"),
  contextNostalgiaLabel: document.getElementById("contextNostalgiaLabel"),
  recommendationInlineStatus: document.getElementById("recommendationInlineStatus"),
  recommendationStatus: document.getElementById("recommendationStatus"),
  recommendationScoreNote: document.getElementById("recommendationScoreNote"),
  vibeMatchBlock: document.getElementById("vibeMatchBlock"),
  vibeMatchFill: document.getElementById("vibeMatchFill"),
  vibeMatchValue: document.getElementById("vibeMatchValue"),
  vibeMatchMeter: document.getElementById("vibeMatchMeter"),
  recommendationEraBadge: document.getElementById("recommendationEraBadge"),
  djRemixMode: document.getElementById("djRemixMode"),
  djAutopilotEnabled: document.getElementById("djAutopilotEnabled"),
  djAutopilotStatus: document.getElementById("djAutopilotStatus"),
  recommendationPrimary: document.getElementById("recommendationPrimary"),
  recommendationAlbumArt: document.getElementById("recommendationAlbumArt"),
  recommendationTitle: document.getElementById("recommendationTitle"),
  recommendationArtist: document.getElementById("recommendationArtist"),
  recommendationPlan: document.getElementById("recommendationPlan"),
  recommendationScoreChip: document.getElementById("recommendationScoreChip"),
  recommendationOffsetChip: document.getElementById("recommendationOffsetChip"),
  flowInjectionIndicator: document.getElementById("flowInjectionIndicator"),
  recommendationCandidates: document.getElementById("recommendationCandidates"),
  useRecommendationButton: document.getElementById("useRecommendationButton"),
  queueRecommendationButton: document.getElementById("queueRecommendationButton"),
  queueTopCandidatesButton: document.getElementById("queueTopCandidatesButton"),
  smartQueueStatus: document.getElementById("smartQueueStatus"),
  smartQueueInlineStatus: document.getElementById("smartQueueInlineStatus"),
  queueSmartQueueButton: document.getElementById("queueSmartQueueButton")
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
let smartQueueInFlight = false;
const NOW_PLAYING_POLL_ACTIVE_MS = 1000;
const NOW_PLAYING_POLL_IDLE_MS = 1800;
const PLAYBACK_STATE_CACHE_TTL_MS = 650;
let autoplayIntervalId = null;
let autoplayInFlight = false;
let lastAutoplayTriggerTrackUri = null;
let flowInjectionWatcherId = null;
let flowInjectionInFlight = false;
let pendingFlowInjection = null;
let lastInjectedAiTrackId = null;
const ENV_SIGNALS_CACHE_TTL_MS = 20 * 60 * 1000;
let cachedEnvironmentSignals = null;
let environmentSignalsFetchedAtMs = 0;
let environmentRefreshPromise = null;
let cachedSpotifyProfileContext = null;
let spotifyProfileFetchPromise = null;
let playbackStateCache = {
  token: "",
  fetchedAtMs: 0,
  payload: null
};
let playbackStateInFlight = null;
let nowPlayingTickerId = null;
let nowPlayingTickerState = null;
const lyricsCache = new Map();
let activeLyricTrackUri = "";
let activeLyricChunks = [];
let activeTimedLyricLines = [];
let activeLyricSource = "waiting";
let activeLyricFetchTrackUri = "";
let lyricsListSignature = "";
let lastLyricVisualFingerprint = "";
let lyricsPlaceholderFadeGeneration = 0;
let lastLyricMarqueeText = "";

const LYRIC_LINE_FADE_IN_MS = 520;
let heroCoverBarRgb = null;
let heroCoverPaletteSourceUrl = "";
let heroVisualizerBars = [];
let heroVisualizerBarLevels = [];
let heroVisualizerAnimFrameId = null;
const HERO_VISUALIZER_BAR_COUNT = 30;

// Bars are grouped into "instrument" bands so each cluster reacts to the
// music with its own hue, sensitivity, and attack/release feel instead of
// all 30 bars moving identically.
const HERO_VISUALIZER_INSTRUMENT_BANDS = [
  { name: "bass", hue: 6, sensitivity: 1.18, attackMul: 0.72, releaseMul: 0.5 },
  { name: "drums", hue: 42, sensitivity: 1.05, attackMul: 1.4, releaseMul: 1.3 },
  { name: "melody", hue: 150, sensitivity: 0.96, attackMul: 1.0, releaseMul: 0.85 },
  { name: "vocals", hue: 258, sensitivity: 1.1, attackMul: 1.22, releaseMul: 0.68 }
];

function getInstrumentBand(index, barCount) {
  const bandCount = HERO_VISUALIZER_INSTRUMENT_BANDS.length;
  const bandIndex = clamp(
    Math.floor((index / Math.max(1, barCount)) * bandCount),
    0,
    bandCount - 1
  );
  return HERO_VISUALIZER_INSTRUMENT_BANDS[bandIndex];
}
let visualizerAudioContext = null;
let visualizerAnalyser = null;
let visualizerMicStream = null;
let visualizerFrequencyData = null;
let visualizerAudioInitPromise = null;
let visualizerAudioPermissionState = "pending";
const SONG_SPECTRUM_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const songSpectrumCache = new Map();
let activeSongSpectrumTrackId = "";
let activeSongSpectrumSegments = [];
let activeSongSpectrumFetchTrackId = "";
let activeSongSpectrumSegmentIndex = 0;

const PROVIDER_DISPLAY_NAMES = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple_music: "Apple Music",
  youtube_music: "YouTube Music",
  tidal: "Tidal"
};

function getSelectedProvider() {
  return elements.provider.value;
}

function isProviderSupported(provider) {
  return provider === "spotify";
}

function tryAutoSelectProviderFromText(rawText) {
  const detected = detectProviderFromUrl(rawText);
  if (!detected || !elements.provider) {
    return false;
  }
  if (elements.provider.value === detected) {
    return false;
  }
  elements.provider.value = detected;
  saveInputsToLocalStorage();
  invalidatePlaybackStateCache();
  updateProviderUi();
  return true;
}

function updatePlatformBetaBanner() {
  const banner = document.getElementById("platformBetaBanner");
  const labelEl = document.getElementById("platformBetaLabel");
  if (!banner || !labelEl) {
    return;
  }
  const provider = getSelectedProvider();
  if (isProviderSupported(provider)) {
    banner.classList.add("hidden");
    return;
  }
  const strategy = getProviderStrategy(provider);
  labelEl.textContent = strategy.label;
  banner.classList.remove("hidden");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rgbToHslChannel(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
    }
  }
  return { h: h * 360, s, l };
}

function coverRgbToBarGradient(rgb, smoothed, accent, band) {
  const { h, s, l } = rgbToHslChannel(rgb.r, rgb.g, rgb.b);
  const energy = accent != null ? accent : smoothed;
  const bandHue = band ? band.hue : h;
  const h0 = (h * 0.6 + bandHue * 0.4 + 360) % 360;
  const satPct = clamp(s * 100 * (1.05 + energy * 0.15), 38, 100);
  const baseLPct = clamp(l * 100, 10, 88);
  const topL = clamp(baseLPct + 20 + smoothed * 28, 32, 97);
  const botL = clamp(baseLPct - 8 + smoothed * 22, 12, 78);
  const topColor = `hsla(${h0.toFixed(1)}, ${satPct.toFixed(1)}%, ${topL.toFixed(1)}%, 0.97)`;
  const bottomColor = `hsla(${((h0 + 14) % 360).toFixed(1)}, ${(satPct * 0.88).toFixed(1)}%, ${botL.toFixed(1)}%, 0.9)`;
  const glow = `hsla(${h0.toFixed(1)}, ${satPct.toFixed(1)}%, ${topL.toFixed(1)}%, ${(0.24 + smoothed * 0.44).toFixed(2)})`;
  return { topColor, bottomColor, glow };
}

function hslFallbackBarGradient(index, smoothed, accent, band) {
  const energy = accent != null ? accent : smoothed;
  const baseHue = band ? band.hue : (index / Math.max(1, heroVisualizerBars.length - 1)) * 285;
  const hue = (baseHue + energy * 26) % 360;
  const topColor = `hsla(${hue.toFixed(0)}, 97%, ${(48 + smoothed * 30).toFixed(1)}%, 0.97)`;
  const bottomColor = `hsla(${((hue + 32) % 360).toFixed(0)}, 90%, ${(28 + smoothed * 20).toFixed(1)}%, 0.9)`;
  const glow = `hsla(${hue.toFixed(0)}, 98%, ${(48 + smoothed * 24).toFixed(1)}%, ${(0.28 + smoothed * 0.4).toFixed(2)})`;
  return { topColor, bottomColor, glow };
}

function paintHeroBarColors(index, smoothed, accent = null) {
  const bar = heroVisualizerBars[index];
  if (!bar) {
    return;
  }
  const band = getInstrumentBand(index, heroVisualizerBars.length);
  const rgb = heroCoverBarRgb?.[index];
  const { topColor, bottomColor, glow } = rgb
    ? coverRgbToBarGradient(rgb, smoothed, accent, band)
    : hslFallbackBarGradient(index, smoothed, accent, band);
  bar.style.background = `linear-gradient(180deg, ${topColor}, ${bottomColor})`;
  bar.style.boxShadow = `0 0 ${Math.round(8 + smoothed * 17)}px ${glow}`;
}

function updatePageVibeBackgroundFromCover(rgbList) {
  const el = document.getElementById("pageVibeBackground");
  if (!el) {
    return;
  }
  if (!rgbList || rgbList.length === 0) {
    el.style.background = "";
    return;
  }
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of rgbList) {
    r += c.r;
    g += c.g;
    b += c.b;
  }
  const n = rgbList.length;
  r /= n;
  g /= n;
  b /= n;
  const rD = Math.round(r * 0.42);
  const gD = Math.round(g * 0.42);
  const bD = Math.round(b * 0.42);
  const rL = Math.min(255, Math.round(r * 1.08));
  const gL = Math.min(255, Math.round(g * 1.08));
  const bL = Math.min(255, Math.round(b * 1.08));
  el.style.background = `
    radial-gradient(ellipse 90% 70% at 18% 24%, rgba(${rL},${gL},${bL},0.36), transparent 56%),
    radial-gradient(ellipse 82% 58% at 84% 78%, rgba(${rD},${gD},${bD},0.26), transparent 52%),
    linear-gradient(165deg, #070a14 0%, #04060c 100%)`;
}

function clearHeroCoverPalette() {
  heroCoverBarRgb = null;
  heroCoverPaletteSourceUrl = "";
  updatePageVibeBackgroundFromCover(null);
}

function refreshHeroCoverPalette(imageUrl) {
  const url = String(imageUrl ?? "").trim();
  if (!url) {
    clearHeroCoverPalette();
    return;
  }

  heroCoverPaletteSourceUrl = url;
  heroCoverBarRgb = null;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";

  const applyFromImage = () => {
    if (heroCoverPaletteSourceUrl !== url) {
      return;
    }
    try {
      const sampleW = 64;
      const sampleH = 44;
      const canvas = document.createElement("canvas");
      canvas.width = sampleW;
      canvas.height = sampleH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        return;
      }
      ctx.drawImage(img, 0, 0, sampleW, sampleH);
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
      const barCount = HERO_VISUALIZER_BAR_COUNT;
      const nextRgb = [];
      for (let bi = 0; bi < barCount; bi += 1) {
        const x0 = Math.floor((bi / barCount) * sampleW);
        const bandW = Math.max(1, Math.ceil(sampleW / barCount));
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let y = 0; y < sampleH; y += 1) {
          for (let x = x0; x < Math.min(sampleW, x0 + bandW); x += 1) {
            const i = (y * sampleW + x) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count += 1;
          }
        }
        if (count === 0) {
          nextRgb.push({ r: 80, g: 160, b: 255 });
        } else {
          nextRgb.push({ r: r / count, g: g / count, b: b / count });
        }
      }
      if (heroCoverPaletteSourceUrl === url) {
        heroCoverBarRgb = nextRgb;
        updatePageVibeBackgroundFromCover(heroCoverBarRgb);
      }
    } catch {
      if (heroCoverPaletteSourceUrl === url) {
        heroCoverBarRgb = null;
        updatePageVibeBackgroundFromCover(null);
      }
    }
  };

  img.onload = applyFromImage;
  img.onerror = () => {
    if (heroCoverPaletteSourceUrl === url) {
      heroCoverBarRgb = null;
      updatePageVibeBackgroundFromCover(null);
    }
  };
  img.src = url;
}

function clearInlineStatusTimers(element) {
  if (element._inlineStatusFadeTimeout) {
    clearTimeout(element._inlineStatusFadeTimeout);
    element._inlineStatusFadeTimeout = null;
  }
  if (element._inlineStatusHideTimeout) {
    clearTimeout(element._inlineStatusHideTimeout);
    element._inlineStatusHideTimeout = null;
  }
}

function hideInlineStatus(element) {
  clearInlineStatusTimers(element);
  element.textContent = "";
  element.classList.add("hidden");
  element.classList.remove("info", "success", "error", "fading");
}

function setInlineStatus(element, message = "", tone = "info") {
  if (!element) {
    return;
  }
  clearInlineStatusTimers(element);
  const text = String(message ?? "").trim();
  if (!text) {
    hideInlineStatus(element);
    return;
  }

  element.textContent = "";
  element.classList.remove("hidden", "fading", "info", "success", "error");
  element.classList.add(tone);

  const textSpan = document.createElement("span");
  textSpan.className = "inline-status-text";
  textSpan.textContent = text;

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "inline-status-dismiss";
  dismissButton.setAttribute("aria-label", "Dismiss message");
  dismissButton.textContent = "\u00d7";
  dismissButton.addEventListener("click", () => hideInlineStatus(element));

  element.appendChild(textSpan);
  element.appendChild(dismissButton);

  const fadeDelayMs = tone === "error" ? 9000 : 6000;
  element._inlineStatusFadeTimeout = setTimeout(() => {
    element.classList.add("fading");
    element._inlineStatusHideTimeout = setTimeout(() => hideInlineStatus(element), 700);
  }, fadeDelayMs);
}

function setSearchInlineStatus(message = "", tone = "info") {
  setInlineStatus(elements.searchInlineStatus, message, tone);
}

function setActionInlineStatus(message = "", tone = "info") {
  setInlineStatus(elements.actionInlineStatus, message, tone);
}

function setRecommendationInlineStatus(message = "", tone = "info") {
  setInlineStatus(elements.recommendationInlineStatus, message, tone);
}

function invalidatePlaybackStateCache() {
  playbackStateCache = {
    token: "",
    fetchedAtMs: 0,
    payload: null
  };
}

function getOrCreateDjSessionId() {
  const existing = localStorage.getItem(DJ_SESSION_ID_KEY);
  if (existing) {
    return existing;
  }

  const next =
    (window.crypto && "randomUUID" in window.crypto && window.crypto.randomUUID()) ||
    `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DJ_SESSION_ID_KEY, next);
  return next;
}

function isAdvancedSettingsVisible() {
  return (localStorage.getItem(ADVANCED_SETTINGS_VISIBLE_KEY) ?? "false") === "true";
}

function setAdvancedSettingsVisible(visible) {
  const shouldShow = Boolean(visible);
  localStorage.setItem(ADVANCED_SETTINGS_VISIBLE_KEY, shouldShow ? "true" : "false");
  const details = document.getElementById("systemConfigDetails");
  if (details) {
    details.open = shouldShow;
  }
}

function getActiveAppView() {
  const saved = localStorage.getItem(ACTIVE_APP_VIEW_KEY);
  return APP_VIEW_NAMES.includes(saved) ? saved : "player";
}

function setActiveAppView(viewName) {
  const name = APP_VIEW_NAMES.includes(viewName) ? viewName : "player";
  
  // Save scroll position of currently active view
  const currentView = document.querySelector(".app-view.is-active");
  if (currentView) {
    const currentViewName = currentView.id.replace("view-", "");
    saveScrollPosition(currentViewName);
  }
  
  localStorage.setItem(ACTIVE_APP_VIEW_KEY, name);

  for (const tab of document.querySelectorAll(".app-nav-tab")) {
    const isActive = tab.dataset.view === name;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (const panel of document.querySelectorAll(".app-view")) {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === name);
  }
  
  // Restore scroll position for new view
  requestAnimationFrame(() => {
    restoreScrollPosition(name);
  });
}

function moodLabelFromLevel(level) {
  const value = clamp(Number(level) || 0, 0, 100);
  if (value <= 25) {
    return "Mellow";
  }
  if (value <= 45) {
    return "Chill";
  }
  if (value <= 65) {
    return "Balanced";
  }
  if (value <= 85) {
    return "Upbeat";
  }
  return "Hype";
}

const SOUTHERN_HEMISPHERE_COUNTRY_CODES = new Set([
  "AR",
  "AU",
  "BO",
  "BR",
  "BW",
  "CL",
  "FK",
  "GF",
  "MG",
  "MZ",
  "NA",
  "NZ",
  "PY",
  "RE",
  "SH",
  "SR",
  "SZ",
  "TZ",
  "UY",
  "ZA",
  "ZW",
  "PF",
  "NC",
  "WF"
]);

function isSouthernHemisphereHint(latitude, countryCode) {
  if (Number.isFinite(latitude) && latitude !== 0) {
    return latitude < 0;
  }
  return SOUTHERN_HEMISPHERE_COUNTRY_CODES.has(String(countryCode ?? "").trim().toUpperCase());
}

function seasonVibeLabel(monthIndex, southern) {
  const m = monthIndex;
  if (!southern) {
    if (m >= 2 && m <= 4) {
      return "Spring vibe";
    }
    if (m >= 5 && m <= 7) {
      return "Summer vibe";
    }
    if (m >= 8 && m <= 10) {
      return "Autumn vibe";
    }
    return "Winter vibe";
  }
  if (m >= 8 && m <= 10) {
    return "Spring vibe";
  }
  if (m === 11 || m <= 1) {
    return "Summer vibe";
  }
  if (m >= 2 && m <= 4) {
    return "Autumn vibe";
  }
  return "Winter vibe";
}

function baselineTempCForLocalSeason(now, southern) {
  const month = now.getMonth();
  const effectiveMonth = southern ? (month + 6) % 12 : month;
  const hour = now.getHours();
  let baselineTemp = 22;
  if ([11, 0, 1].includes(effectiveMonth)) {
    baselineTemp = 9;
  } else if ([5, 6, 7].includes(effectiveMonth)) {
    baselineTemp = 28;
  } else if ([2, 3, 4].includes(effectiveMonth)) {
    baselineTemp = 18;
  } else {
    baselineTemp = 20;
  }
  const diurnalShift = hour >= 14 && hour <= 18 ? 2 : hour <= 6 ? -2 : 0;
  return Math.round(baselineTemp + diurnalShift);
}

function mapWmoWeatherCode(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) {
    return { weather: "clear", label: "Clear" };
  }
  if (c === 0) {
    return { weather: "clear", label: "Clear" };
  }
  if (c === 1) {
    return { weather: "mainly clear", label: "Mainly clear" };
  }
  if (c === 2) {
    return { weather: "partly cloudy", label: "Partly cloudy" };
  }
  if (c === 3) {
    return { weather: "overcast", label: "Overcast" };
  }
  if (c === 45 || c === 48) {
    return { weather: "fog", label: "Fog" };
  }
  if (c >= 51 && c <= 55) {
    return { weather: "light drizzle rain", label: "Drizzle" };
  }
  if (c === 56 || c === 57) {
    return { weather: "freezing drizzle rain", label: "Freezing drizzle" };
  }
  if (c >= 61 && c <= 65) {
    return { weather: "rain", label: "Rain" };
  }
  if (c === 66 || c === 67) {
    return { weather: "freezing rain", label: "Freezing rain" };
  }
  if (c >= 71 && c <= 77) {
    return { weather: "snow", label: "Snow" };
  }
  if (c === 80 || c === 81) {
    return { weather: "rain showers", label: "Rain showers" };
  }
  if (c === 82) {
    return { weather: "heavy rain showers", label: "Heavy showers" };
  }
  if (c === 85 || c === 86) {
    return { weather: "snow showers", label: "Snow showers" };
  }
  if (c >= 95 && c <= 99) {
    return { weather: "thunderstorm rain", label: "Thunderstorm" };
  }
  return { weather: "cloudy", label: "Cloudy" };
}

function computeFallbackEnvironmentSignals() {
  const now = new Date();
  const profileCountry = String(cachedSpotifyProfileContext?.countryCode ?? "")
    .trim()
    .toUpperCase();
  const navCountry = getCountryCodeFromNavigator();
  const countryCode = profileCountry || navCountry;
  const southern = isSouthernHemisphereHint(null, countryCode);
  return {
    tempC: baselineTempCForLocalSeason(now, southern),
    weather: "clear",
    weatherLabel: "Clear (estimated — enable location for live weather)",
    seasonVibe: seasonVibeLabel(now.getMonth(), southern),
    source: "fallback",
    latitude: null,
    longitude: null
  };
}

function getEnvironmentSignalsSync() {
  const nowMs = Date.now();
  if (
    cachedEnvironmentSignals &&
    cachedEnvironmentSignals.source === "openmeteo" &&
    nowMs - environmentSignalsFetchedAtMs < ENV_SIGNALS_CACHE_TTL_MS
  ) {
    return cachedEnvironmentSignals;
  }
  return computeFallbackEnvironmentSignals();
}

async function refreshLiveEnvironmentSignals() {
  const nowMs = Date.now();
  if (
    cachedEnvironmentSignals?.source === "openmeteo" &&
    nowMs - environmentSignalsFetchedAtMs < ENV_SIGNALS_CACHE_TTL_MS
  ) {
    return cachedEnvironmentSignals;
  }
  if (environmentRefreshPromise) {
    return environmentRefreshPromise;
  }

  environmentRefreshPromise = (async () => {
    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation unavailable");
      }
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 10 * 60 * 1000,
          timeout: 12_000
        });
      });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
        String(lat)
      )}&longitude=${encodeURIComponent(
        String(lon)
      )}&current=temperature_2m,weather_code,is_day&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Open-Meteo HTTP ${res.status}`);
      }
      const data = await res.json();
      const t = data?.current?.temperature_2m;
      const code = data?.current?.weather_code;
      if (!Number.isFinite(Number(t))) {
        throw new Error("Open-Meteo missing temperature");
      }
      const mapped = mapWmoWeatherCode(code);
      const southern = lat < 0;
      cachedEnvironmentSignals = {
        tempC: Math.round(Number(t)),
        weather: String(mapped.weather).toLowerCase(),
        weatherLabel: mapped.label,
        seasonVibe: seasonVibeLabel(new Date().getMonth(), southern),
        source: "openmeteo",
        latitude: lat,
        longitude: lon
      };
      environmentSignalsFetchedAtMs = Date.now();
      updateEnvironmentContextBar();
      return cachedEnvironmentSignals;
    } catch {
      updateEnvironmentContextBar();
      return null;
    } finally {
      environmentRefreshPromise = null;
    }
  })();

  return environmentRefreshPromise;
}

function getCountryCodeFromNavigator() {
  const locale = String(navigator.language || "").trim();
  const match = locale.match(/-([A-Za-z]{2})$/);
  return match?.[1] ? match[1].toUpperCase() : "";
}

function getEmailDomain(value) {
  const email = String(value ?? "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    return "";
  }
  return email.slice(at + 1);
}

async function refreshSpotifyProfileContext({ silent = true } = {}) {
  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    cachedSpotifyProfileContext = null;
    return null;
  }

  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) {
    cachedSpotifyProfileContext = null;
    return null;
  }

  if (spotifyProfileFetchPromise) {
    return spotifyProfileFetchPromise;
  }

  spotifyProfileFetchPromise = (async () => {
    try {
      const profile = await apiRequest(
        "/auth/spotify/profile",
        "GET",
        accessToken
      );
      cachedSpotifyProfileContext = {
        countryCode: String(profile?.country ?? "").trim().toUpperCase(),
        emailDomain: getEmailDomain(profile?.email)
      };
      updateEnvironmentContextBar();
      return cachedSpotifyProfileContext;
    } catch (error) {
      if (!silent) {
        logStatus(`Could not sync Spotify profile context: ${error.message}`);
      }
      cachedSpotifyProfileContext = null;
      updateEnvironmentContextBar();
      return null;
    } finally {
      spotifyProfileFetchPromise = null;
    }
  })();

  return spotifyProfileFetchPromise;
}

async function loadPersonalizationData({ silent = true } = {}) {
  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) return null;

  try {
    const data = await apiRequest(
      "/auth/personalization",
      "GET",
      accessToken
    );
    if (data) {
      if (data.country) {
        elements.locationStatus.textContent = `From Spotify: ${data.country}`;
      }
      if (data.age) {
        elements.listenerAge.value = data.age;
      }
      if (data.gender && data.gender !== 'unspecified') {
        elements.listenerGender.value = data.gender;
      }
    }
    return data;
  } catch (error) {
    if (!silent) {
      logStatus(`Could not load personalization data: ${error.message}`);
    }
    return null;
  }
}

async function savePersonalizationData() {
  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) return false;

  const age = Number(elements.listenerAge.value);
  const gender = elements.listenerGender.value;

  if (!age || !gender || gender === 'unspecified') {
    return false;
  }

  try {
    const result = await apiRequest(
      "/auth/personalization",
      "POST",
      accessToken,
      { age, gender }
    );
    if (result?.saved) {
      logStatus("Personalization settings saved.");
      return true;
    }
  } catch (error) {
    logStatus(`Could not save personalization: ${error.message}`);
  }
  return false;
}

function nostalgiaLabelFromLevel(n) {
  const v = clamp(Number(n) || 0, 0, 100);
  if (v <= 5) {
    return "Modern focus";
  }
  if (v <= 33) {
    return "Mostly modern";
  }
  if (v <= 67) {
    return "Balanced eras";
  }
  if (v <= 95) {
    return "Era-leaning";
  }
  return "Pure era";
}

function buildUserContext() {
  const signals = getEnvironmentSignalsSync();
  const moodLevel = clamp(Number(elements.contextMoodLevel.value || 50), 0, 100);
  const nostalgiaSlider = clamp(
    Number(elements.contextNostalgiaSlider?.value ?? 50),
    0,
    100
  );
  const profileCountry = String(cachedSpotifyProfileContext?.countryCode ?? "")
    .trim()
    .toUpperCase();
  const emailDomain = String(cachedSpotifyProfileContext?.emailDomain ?? "")
    .trim()
    .toLowerCase();

  return {
    tempC: signals.tempC,
    weather: signals.weather,
    weatherLabel: signals.weatherLabel ?? signals.weather,
    seasonVibe: signals.seasonVibe ?? "",
    environmentSource: signals.source ?? "fallback",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    countryCode: profileCountry || getCountryCodeFromNavigator(),
    localHour: new Date().getHours(),
    accountAgeYears: 0,
    age: Number(elements.listenerAge?.value) || null,
    gender: elements.listenerGender?.value || "unspecified",
    emailDomain,
    moodLevel,
    nostalgiaSlider
  };
}

const VIBE_TEMP_DISPLAY_UNIT_KEY = "vibeTempDisplayUnit";

function getStoredTempDisplayUnit() {
  return String(localStorage.getItem(VIBE_TEMP_DISPLAY_UNIT_KEY) ?? "auto")
    .trim()
    .toLowerCase();
}

function resolveOutdoorTempDisplayFahrenheit() {
  const stored = getStoredTempDisplayUnit();
  if (stored === "celsius" || stored === "c") {
    return false;
  }
  if (stored === "fahrenheit" || stored === "f") {
    return true;
  }
  const profile = String(cachedSpotifyProfileContext?.countryCode ?? "")
    .trim()
    .toUpperCase();
  const nav = getCountryCodeFromNavigator();
  return profile === "US" || nav === "US";
}

function celsiusToFahrenheitRounded(tempC) {
  const c = Number(tempC);
  if (!Number.isFinite(c)) {
    return 0;
  }
  return Math.round((c * 9) / 5 + 32);
}

function formatOutdoorTempBadge(tempC, useFahrenheit) {
  const c = Math.round(Number(tempC) || 0);
  if (useFahrenheit) {
    return `${celsiusToFahrenheitRounded(c)}\u202F°F`;
  }
  return `${c}\u202F°C`;
}

function outdoorTempBadgeTitle(tempC, useFahrenheit, liveEnv) {
  const c = Math.round(Number(tempC) || 0);
  const f = celsiusToFahrenheitRounded(c);
  const primary = useFahrenheit ? `${f} °F` : `${c} °C`;
  const secondary = useFahrenheit ? `${c} °C` : `${f} °F`;
  const src = liveEnv
    ? "Live (Open-Meteo). Recommendations still use °C under the hood."
    : "Estimated until location is on. Recommendations still use °C under the hood.";
  return `${primary} (${secondary}). ${src} Click to cycle °F / °C / auto (auto: °F in US).`;
}

function cycleOutdoorTempDisplayUnit() {
  const cur = getStoredTempDisplayUnit();
  let next = "auto";
  if (cur === "auto" || cur === "") {
    next = "celsius";
  } else if (cur === "celsius" || cur === "c") {
    next = "fahrenheit";
  } else {
    next = "auto";
  }
  localStorage.setItem(VIBE_TEMP_DISPLAY_UNIT_KEY, next);
  updateEnvironmentContextBar();
}

function weatherEmoji(weather) {
  const s = String(weather ?? "").toLowerCase();
  if (!s || s === "unknown") {
    return "🌤️";
  }
  if (s.includes("rain") || s.includes("drizzle")) {
    return "🌧️";
  }
  if (s.includes("cloud")) {
    return "☁️";
  }
  if (s.includes("snow")) {
    return "❄️";
  }
  if (s.includes("fog")) {
    return "🌫️";
  }
  if (s.includes("storm") || s.includes("thunder")) {
    return "⛈️";
  }
  if (s.includes("clear") || s.includes("sun")) {
    return "☀️";
  }
  return "🌤️";
}

function renderContextBadges() {
  if (!elements.environmentContextBadges) {
    return;
  }
  const context = buildUserContext();
  const moodLabel = moodLabelFromLevel(context.moodLevel);
  const tempC = Number(context.tempC);
  const useFahrenheit = resolveOutdoorTempDisplayFahrenheit();
  const tempBadgeText = formatOutdoorTempBadge(tempC, useFahrenheit);
  const wIcon = weatherEmoji(context.weather);
  const weatherLabel = String(context.weatherLabel || context.weather || "Clear");
  const seasonVibe = String(context.seasonVibe || "").trim();
  const region = context.countryCode || "—";
  const nostalgiaShort = nostalgiaLabelFromLevel(context.nostalgiaSlider);
  const liveEnv = context.environmentSource === "openmeteo";
  const tempTitle = outdoorTempBadgeTitle(tempC, useFahrenheit, liveEnv);
  const wxTitle = liveEnv
    ? "Current conditions from Open-Meteo (WMO codes)"
    : "Conditions not available without location — defaulting to clear";
  const seasonTitle =
    "Season label uses calendar month; hemisphere from your coordinates when location is on, otherwise from your Spotify country or browser locale.";
  const seasonHtml = seasonVibe
    ? `<span class="ctx-badge" title="${seasonTitle}"><span class="ic">🗓️</span>${seasonVibe}</span>`
    : "";
  elements.environmentContextBadges.innerHTML = `
    <span class="ctx-badge" title="Mood"><span class="ic">🎚️</span>${moodLabel}</span>
    <span class="ctx-badge" title="Nostalgia timeline (release-year fit)"><span class="ic">⏳</span>${nostalgiaShort}</span>
    ${seasonHtml}
    <span class="ctx-badge ctx-badge--clickable" data-temp-display-cycle="1" role="button" tabindex="0" title="${tempTitle}"><span class="ic">🌡️</span>${tempBadgeText}</span>
    <span class="ctx-badge" title="${wxTitle}"><span class="ic">${wIcon}</span>${weatherLabel}</span>
    <span class="ctx-badge" title="Region"><span class="ic">🌍</span>${region}</span>
  `;
}

function updateEnvironmentContextBar() {
  const context = buildUserContext();
  const moodLabel = moodLabelFromLevel(context.moodLevel);
  elements.contextMoodLabel.textContent = `${moodLabel} (${Math.round(
    context.moodLevel
  )})`;
  if (elements.contextNostalgiaLabel && elements.contextNostalgiaSlider) {
    const nl = nostalgiaLabelFromLevel(context.nostalgiaSlider);
    elements.contextNostalgiaLabel.textContent = `${nl} (${Math.round(
      context.nostalgiaSlider
    )})`;
  }
  renderContextBadges();
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
}

function setPauseResumeButtonLabel(isPlaying) {
  elements.quickPauseResumeButton.textContent = isPlaying ? "⏸" : "▶";
  elements.quickPauseResumeButton.setAttribute("aria-label", isPlaying ? "Pause" : "Resume");
}

function setFlowInjectionIndicator(message = "") {
  if (!message) {
    elements.flowInjectionIndicator.classList.add("hidden");
    elements.flowInjectionIndicator.textContent = "Flow boost";
    return;
  }
  elements.flowInjectionIndicator.classList.remove("hidden");
  elements.flowInjectionIndicator.textContent = message;
}

function computeBpmMatchPercent(currentTempo, candidateTempo) {
  const a = Number(currentTempo);
  const b = Number(candidateTempo);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return null;
  }

  const direct = Math.abs(a - b);
  const halfDoubleA = Math.abs(a * 2 - b);
  const halfDoubleB = Math.abs(a - b * 2);
  const distance = Math.min(direct, halfDoubleA, halfDoubleB);
  const percentDiff = (distance / a) * 100;
  return Math.max(0, Math.min(100, 100 - percentDiff));
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


    const playNowButton = document.createElement("button");
    playNowButton.type = "button";
    playNowButton.textContent = "Play Now";
    playNowButton.addEventListener("click", async () => {
      setTrackInput(track.uri);
      // "Start offset" is meant for DJ-transition auto-seek (skipping into a track for
      // a smooth mix) and persists across sessions. A fresh pick from search has nothing
      // to do with that — it should always start at 0:00, not whatever offset was last
      // left over from a prior transition.
      elements.offsetSeconds.value = "0";
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
    actions.appendChild(playNowButton);
    actions.appendChild(queueButton);
    actions.appendChild(queueSeekButton);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(actions);
    elements.searchResults.appendChild(card);
  });
}

function clearSearchUiAfterQueue({ preserveResults = true } = {}) {
  if (!preserveResults) {
    elements.trackSearchQuery.value = "";
    clearSearchResults();
  }
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

function setHeroAlbumVisual(imageUrl, altText) {
  const ph = elements.nowPlayingHeroArtPlaceholder;
  const imgEl = elements.nowPlayingHeroAlbumArt;
  if (imageUrl) {
    setAlbumArt(imgEl, imageUrl, altText);
    imgEl.classList.remove("hidden");
    ph?.classList.add("hidden");
    elements.nowPlayingHeroBg.style.backgroundImage = `url("${imageUrl}")`;
    refreshHeroCoverPalette(imageUrl);
    return;
  }
  imgEl.removeAttribute("src");
  imgEl.classList.add("hidden");
  ph?.classList.remove("hidden");
  elements.nowPlayingHeroBg.style.backgroundImage = "none";
  clearHeroCoverPalette();
}

function ensureHeroVisualizerBars() {
  if (!elements.nowPlayingVisualizer) {
    return;
  }
  if (heroVisualizerBars.length > 0) {
    return;
  }
  elements.nowPlayingVisualizer.innerHTML = "";
  heroVisualizerBarLevels = [];
  for (let index = 0; index < HERO_VISUALIZER_BAR_COUNT; index += 1) {
    const bar = document.createElement("span");
    bar.className = "hero-visualizer-bar";
    bar.style.transform = "scaleY(0.2)";
    elements.nowPlayingVisualizer.appendChild(bar);
    heroVisualizerBars.push(bar);
    heroVisualizerBarLevels.push(0.2);
  }
  for (let i = 0; i < heroVisualizerBars.length; i += 1) {
    paintHeroBarColors(i, 0.2, 0);
  }
}

function hasLiveAudioSpectrum() {
  return Boolean(visualizerAnalyser && visualizerFrequencyData);
}

function hasSongSpectrum() {
  return activeSongSpectrumSegments.length > 0;
}

function hasPlaybackSyncedSpectrumFallback() {
  const tid = String(nowPlayingTickerState?.trackId ?? "").trim();
  return Boolean(
    tid &&
      tid === String(activeSongSpectrumTrackId ?? "").trim() &&
      !hasSongSpectrum()
  );
}

function normalizeSongSpectrumSegments(rawSegments) {
  if (!Array.isArray(rawSegments)) {
    return [];
  }
  return rawSegments
    .map((segment) => ({
      startMs: Math.max(0, Number(segment?.startMs) || 0),
      durationMs: Math.max(40, Number(segment?.durationMs) || 0),
      confidence: clamp(Number(segment?.confidence) || 0, 0, 1),
      loudnessMax: Number(segment?.loudnessMax ?? -60),
      pitches: Array.isArray(segment?.pitches)
        ? segment.pitches.slice(0, 12).map((value) => clamp(Number(value) || 0, 0, 1))
        : [],
      timbre: Array.isArray(segment?.timbre)
        ? segment.timbre.slice(0, 12).map((value) => clamp(Number(value) || 0, 0, 1))
        : []
    }))
    .filter((segment) => segment.durationMs > 0)
    .sort((a, b) => a.startMs - b.startMs);
}

function getSongSpectrumSegmentForProgress(progressMs) {
  if (!activeSongSpectrumSegments.length) {
    return null;
  }
  const safeProgressMs = Math.max(0, Number(progressMs) || 0);
  let index = clamp(
    Number(activeSongSpectrumSegmentIndex) || 0,
    0,
    activeSongSpectrumSegments.length - 1
  );
  while (
    index < activeSongSpectrumSegments.length - 1 &&
    safeProgressMs >=
      activeSongSpectrumSegments[index].startMs +
        activeSongSpectrumSegments[index].durationMs
  ) {
    index += 1;
  }
  while (index > 0 && safeProgressMs < activeSongSpectrumSegments[index].startMs) {
    index -= 1;
  }
  activeSongSpectrumSegmentIndex = index;
  return activeSongSpectrumSegments[index];
}

function sampleBandValue(values, bandIndex, barCount) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const maxIdx = values.length - 1;
  const scaled = (clamp(bandIndex, 0, Math.max(0, barCount - 1)) / Math.max(1, barCount - 1)) * maxIdx;
  const left = Math.floor(scaled);
  const right = Math.min(maxIdx, left + 1);
  const frac = scaled - left;
  return (Number(values[left]) || 0) * (1 - frac) + (Number(values[right]) || 0) * frac;
}

function computeSongSpectrumLevels(segment, barCount) {
  const loudnessNorm = clamp((Number(segment?.loudnessMax ?? -60) + 60) / 60, 0, 1);
  const confidence = clamp(Number(segment?.confidence) || 0, 0, 1);
  const levels = [];
  for (let index = 0; index < barCount; index += 1) {
    const pitch = sampleBandValue(segment?.pitches, index, barCount);
    const timbre = sampleBandValue(segment?.timbre, index, barCount);
    const leftWeight = 0.85 + (1 - index / Math.max(1, barCount - 1)) * 0.3;
    const combined =
      pitch * 0.56 +
      timbre * 0.24 +
      loudnessNorm * 0.35 +
      confidence * 0.12;
    levels.push(clamp(combined * leftWeight, 0, 1));
  }
  return levels;
}

function extractSpotifyTrackIdFromItem(item) {
  const rawId = String(item?.id ?? "").trim();
  if (/^[A-Za-z0-9]{22}$/.test(rawId)) {
    return rawId;
  }
  const uri = String(item?.uri ?? "").trim();
  const fromUri =
    uri.match(/spotify:track:([A-Za-z0-9]{22})/i)?.[1] ??
    uri.match(/\/track\/([A-Za-z0-9]{22})(?:[/?#]|$)/i)?.[1];
  return fromUri && /^[A-Za-z0-9]{22}$/.test(fromUri) ? fromUri : "";
}

function computeProgressSyncedFallbackLevels(barCount, progressMs, durationMs, trackSeed) {
  const t = (Number(progressMs) || 0) / 1000;
  const durSec = Math.max(8, (Number(durationMs) || 120000) / 1000);
  const normT = t / durSec;
  const seed = Number(trackSeed) || 0;
  const levels = [];
  for (let index = 0; index < barCount; index += 1) {
    const phase = seed * 1.7e-8 + index * 1.17;
    const rate = 0.55 + ((seed + index * 31) % 17) * 0.07;
    const w1 = Math.sin(t * rate + phase);
    const w2 = Math.cos(t * (rate * 0.62 + 0.4) + index * 0.41);
    const w3 = Math.sin(normT * Math.PI * 2 * (2.5 + (index % 5) * 0.35) + seed * 0.003);
    const combined = 0.38 + 0.22 * w1 * w2 + 0.22 * w3;
    const leftWeight = 0.85 + (1 - index / Math.max(1, barCount - 1)) * 0.25;
    levels.push(clamp(combined * leftWeight, 0.06, 1));
  }
  return levels;
}

function pruneSongSpectrumCache() {
  if (songSpectrumCache.size <= 140) {
    return;
  }
  const oldest = [...songSpectrumCache.entries()]
    .sort((a, b) => Number(a[1]?.cachedAtMs ?? 0) - Number(b[1]?.cachedAtMs ?? 0))
    .slice(0, songSpectrumCache.size - 110);
  for (const [key] of oldest) {
    songSpectrumCache.delete(key);
  }
}

async function loadSongSpectrumForTrack(track, accessToken) {
  const trackId = extractSpotifyTrackIdFromItem(track);
  if (!trackId || !/^[A-Za-z0-9]{22}$/.test(trackId) || !accessToken) {
    activeSongSpectrumTrackId = "";
    activeSongSpectrumSegments = [];
    activeSongSpectrumFetchTrackId = "";
    activeSongSpectrumSegmentIndex = 0;
    return;
  }

  const cached = songSpectrumCache.get(trackId);
  const isFresh =
    cached &&
    Date.now() - Number(cached.cachedAtMs ?? 0) <= SONG_SPECTRUM_CACHE_TTL_MS;
  if (isFresh) {
    if (activeSongSpectrumTrackId === trackId) {
      activeSongSpectrumSegments = cached.segments ?? [];
      activeSongSpectrumSegmentIndex = 0;
    }
    return;
  }

  activeSongSpectrumFetchTrackId = trackId;
  try {
    const payload = await apiRequest(
      `/auth/spotify/player/audio-spectrum/${encodeURIComponent(trackId)}`,
      "GET",
      accessToken
    );
    const normalizedSegments = normalizeSongSpectrumSegments(payload?.segments);
    songSpectrumCache.set(trackId, {
      cachedAtMs: Date.now(),
      segments: normalizedSegments
    });
    pruneSongSpectrumCache();
    if (activeSongSpectrumTrackId !== trackId) {
      return;
    }
    activeSongSpectrumSegments = normalizedSegments;
    activeSongSpectrumSegmentIndex = 0;
  } catch {
    if (activeSongSpectrumTrackId !== trackId) {
      return;
    }
    activeSongSpectrumSegments = [];
    activeSongSpectrumSegmentIndex = 0;
  } finally {
    if (activeSongSpectrumFetchTrackId === trackId) {
      activeSongSpectrumFetchTrackId = "";
    }
  }
}

async function ensureAudioReactiveVisualizer() {
  if (hasLiveAudioSpectrum()) {
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    visualizerAudioPermissionState = "unsupported";
    return;
  }
  if (visualizerAudioInitPromise) {
    return visualizerAudioInitPromise;
  }

  visualizerAudioInitPromise = (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        visualizerAudioPermissionState = "unsupported";
        return;
      }
      const context = new AudioCtx();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      visualizerMicStream = stream;
      visualizerAudioContext = context;
      visualizerAnalyser = analyser;
      visualizerFrequencyData = new Uint8Array(analyser.frequencyBinCount);
      visualizerAudioPermissionState = "granted";
      setActionInlineStatus("Live spectrum enabled (microphone pickup).", "success");
    } catch {
      visualizerAudioPermissionState = "denied";
      setActionInlineStatus(
        "Microphone not allowed, using simulated spectrum animation.",
        "info"
      );
    } finally {
      visualizerAudioInitPromise = null;
    }
  })();

  return visualizerAudioInitPromise;
}

function teardownAudioReactiveVisualizer() {
  try {
    if (visualizerMicStream) {
      for (const track of visualizerMicStream.getTracks()) {
        track.stop();
      }
    }
  } catch {
    // Ignore track cleanup errors.
  }

  try {
    if (visualizerAudioContext && visualizerAudioContext.state !== "closed") {
      visualizerAudioContext.close();
    }
  } catch {
    // Ignore close errors.
  }

  visualizerMicStream = null;
  visualizerAudioContext = null;
  visualizerAnalyser = null;
  visualizerFrequencyData = null;
  if (visualizerAudioPermissionState === "granted") {
    visualizerAudioPermissionState = "pending";
  }
}

function hashStringToInt(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function stopHeroVisualizer() {
  if (heroVisualizerAnimFrameId !== null) {
    window.cancelAnimationFrame(heroVisualizerAnimFrameId);
    heroVisualizerAnimFrameId = null;
  }
}

function renderHeroVisualizerFrame() {
  if (heroVisualizerBars.length === 0) {
    return;
  }
  const nowMs = Date.now();
  const isPlaying = Boolean(nowPlayingTickerState?.isPlaying);
  const progressBase = Number(nowPlayingTickerState?.baseProgressMs ?? 0);
  const elapsedMs = Math.max(0, nowMs - Number(nowPlayingTickerState?.renderedAtMs ?? nowMs));
  const progressMs = progressBase + elapsedMs;
  const motionBoost = isPlaying ? 1 : 0.35;

  if (hasSongSpectrum()) {
    const segment = getSongSpectrumSegmentForProgress(progressMs);
    if (segment) {
      const levels = computeSongSpectrumLevels(segment, heroVisualizerBars.length);
      for (let index = 0; index < heroVisualizerBars.length; index += 1) {
        const band = getInstrumentBand(index, heroVisualizerBars.length);
        const target = clamp((levels[index] ?? 0) * motionBoost * band.sensitivity, 0.04, 1);
        const previous = heroVisualizerBarLevels[index] ?? 0.12;
        const attack = (target > previous ? 0.36 : 0.2) * (target > previous ? band.attackMul : band.releaseMul);
        const smoothed = previous + (target - previous) * clamp(attack, 0.06, 0.95);
        heroVisualizerBarLevels[index] = smoothed;

        const bar = heroVisualizerBars[index];
        bar.style.transform = `scaleY(${clamp(0.08 + smoothed, 0.08, 1).toFixed(3)})`;
        paintHeroBarColors(index, smoothed, Number(segment.confidence) || 0);
        bar.style.opacity = isPlaying ? "0.95" : "0.62";
      }
      return;
    }
  }

  if (hasPlaybackSyncedSpectrumFallback()) {
    const durationMs = Math.max(1, Number(nowPlayingTickerState?.durationMs) || 1);
    const seed = Number(nowPlayingTickerState?.trackSeed) || 0;
    const rawLevels = computeProgressSyncedFallbackLevels(
      heroVisualizerBars.length,
      progressMs,
      durationMs,
      seed
    );
    for (let index = 0; index < heroVisualizerBars.length; index += 1) {
      const band = getInstrumentBand(index, heroVisualizerBars.length);
      const target = clamp((rawLevels[index] ?? 0) * motionBoost * band.sensitivity, 0.04, 1);
      const previous = heroVisualizerBarLevels[index] ?? 0.12;
      const attack = (target > previous ? 0.36 : 0.2) * (target > previous ? band.attackMul : band.releaseMul);
      const smoothed = previous + (target - previous) * clamp(attack, 0.06, 0.95);
      heroVisualizerBarLevels[index] = smoothed;

      const bar = heroVisualizerBars[index];
      bar.style.transform = `scaleY(${clamp(0.08 + smoothed, 0.08, 1).toFixed(3)})`;
      paintHeroBarColors(index, smoothed, 0.55);
      bar.style.opacity = isPlaying ? "0.95" : "0.62";
    }
    return;
  }

  if (hasLiveAudioSpectrum()) {
    if (visualizerAudioContext?.state === "suspended") {
      visualizerAudioContext.resume().catch(() => {});
    }
    visualizerAnalyser.getByteFrequencyData(visualizerFrequencyData);
    const binCount = visualizerFrequencyData.length;
    const minBin = 2;
    const maxBin = Math.max(minBin + 1, Math.floor(binCount * 0.82));
    const range = maxBin - minBin;

    for (let index = 0; index < heroVisualizerBars.length; index += 1) {
      const startRatio = Math.pow(index / heroVisualizerBars.length, 1.95);
      const endRatio = Math.pow((index + 1) / heroVisualizerBars.length, 1.95);
      const startBin = minBin + Math.floor(range * startRatio);
      const endBin = minBin + Math.max(startBin + 1, Math.floor(range * endRatio));

      let sum = 0;
      let count = 0;
      for (let bin = startBin; bin < Math.min(endBin, binCount); bin += 1) {
        sum += visualizerFrequencyData[bin] ?? 0;
        count += 1;
      }
      const average = count > 0 ? sum / count : 0;
      const band = getInstrumentBand(index, heroVisualizerBars.length);
      const normalized = clamp((average / 255) * band.sensitivity, 0, 1);

      const previous = heroVisualizerBarLevels[index] ?? 0.2;
      const attack = (normalized > previous ? 0.42 : 0.18) * (normalized > previous ? band.attackMul : band.releaseMul);
      const smoothed = previous + (normalized - previous) * clamp(attack, 0.06, 0.95);
      heroVisualizerBarLevels[index] = smoothed;
      const scaleY = clamp(0.08 + smoothed * 1.12 * motionBoost, 0.08, 1);

      const opacity = isPlaying ? 0.95 : 0.58;

      const bar = heroVisualizerBars[index];
      bar.style.transform = `scaleY(${scaleY.toFixed(3)})`;
      paintHeroBarColors(index, smoothed, normalized);
      bar.style.opacity = String(opacity);
    }
    return;
  }

  // No synthetic "cool wave" fallback: keep bars mostly idle until live audio is enabled.
  for (let index = 0; index < heroVisualizerBars.length; index += 1) {
    const previous = heroVisualizerBarLevels[index] ?? 0.12;
    const decayed = previous + (0.11 - previous) * 0.12;
    heroVisualizerBarLevels[index] = decayed;
    const bar = heroVisualizerBars[index];
    bar.style.transform = `scaleY(${clamp(decayed, 0.08, 0.2).toFixed(3)})`;
    bar.style.opacity = "0.45";
    paintHeroBarColors(index, decayed, 0);
  }
}

function startHeroVisualizer() {
  ensureHeroVisualizerBars();
  if (heroVisualizerAnimFrameId !== null) {
    return;
  }

  const tick = () => {
    renderHeroVisualizerFrame();
    heroVisualizerAnimFrameId = window.requestAnimationFrame(tick);
  };
  heroVisualizerAnimFrameId = window.requestAnimationFrame(tick);
}

function resetLyricCaptionFade() {
  lyricsListSignature = "";
  lastLyricVisualFingerprint = "";
  lastLyricMarqueeText = "";
  lyricsPlaceholderFadeGeneration += 1;
  if (elements.nowPlayingLyricsStage) {
    elements.nowPlayingLyricsStage.style.opacity = "1";
  }
  if (elements.nowPlayingLyricCurrent) {
    elements.nowPlayingLyricCurrent.style.transition = "";
    elements.nowPlayingLyricCurrent.style.opacity = "1";
  }
  hideLyricsTransitionOverlay();
}

function getLyricOffsetMs() {
  return clamp(Number(elements.lyricOffsetMs?.value) || 0, -8000, 8000);
}

function buildLyricsListSignature(lines, uri) {
  return `${uri}|${lines.map((l) => `${l.startMs}:${l.text}`).join("‖")}`;
}

function buildEstimatedTimedLinesFromChunks(chunks, durationMs) {
  const d = Math.max(1, Number(durationMs) || 1);
  const n = chunks.length;
  if (n === 0) {
    return [];
  }
  const slice = d / n;
  return chunks
    .map((text, i) => ({
      startMs: Math.floor(i * slice),
      text: String(text ?? "").trim()
    }))
    .filter((line) => line.text.length > 0);
}

function getUnifiedLyricLines(durationMs) {
  if (activeTimedLyricLines.length > 0) {
    return activeTimedLyricLines;
  }
  if (activeLyricChunks.length > 0) {
    return buildEstimatedTimedLinesFromChunks(activeLyricChunks, durationMs);
  }
  return [];
}

/** Prefer later line when pre-roll overlaps previous line’s tail (fade-in before sing). */
function findLyricDisplayIndex(lines, progressMs, fadeInMs, durationMs) {
  if (!lines.length) {
    return -1;
  }
  const d = Math.max(1, Number(durationMs) || 1);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const start = Math.max(0, lines[i].startMs - fadeInMs);
    const end = i + 1 < lines.length ? lines[i + 1].startMs : d;
    if (progressMs >= start && progressMs < end) {
      return i;
    }
  }
  return -1;
}

function fadeLyricsPlaceholderLine(text, { placeholder = true } = {}) {
  const cur = elements.nowPlayingLyricCurrent;
  if (!cur) {
    return;
  }
  const gen = (lyricsPlaceholderFadeGeneration += 1);
  cur.classList.toggle("is-placeholder", Boolean(placeholder));
  cur.style.transition = "opacity 0.48s ease";
  cur.style.opacity = "0";
  cur.style.animation = "none";
  lastLyricMarqueeText = "";

  window.setTimeout(() => {
    if (gen !== lyricsPlaceholderFadeGeneration) {
      return;
    }
    cur.textContent = text || "\u00a0";
    window.requestAnimationFrame(() => {
      if (gen !== lyricsPlaceholderFadeGeneration) {
        return;
      }
      cur.style.opacity = "1";
    });
  }, 460);
}

function showLyricsPlaceholderMessage(message) {
  const text = String(message ?? "");
  const fp = `placeholder|${text}`;
  if (fp === lastLyricVisualFingerprint) {
    return;
  }
  lastLyricVisualFingerprint = fp;
  lyricsListSignature = fp;
  fadeLyricsPlaceholderLine(text, { placeholder: true });
}

function hideLyricsTransitionOverlay() {
  const el = elements.nowPlayingLyricsTransition;
  const stage = elements.nowPlayingLyricsStage;
  if (el) {
    el.classList.remove("is-visible");
    el.hidden = true;
    el.textContent = "";
  }
  if (stage) {
    stage.style.opacity = "1";
  }
}

function updateLyricsTransitionOverlay(remainingMs) {
  const el = elements.nowPlayingLyricsTransition;
  const stage = elements.nowPlayingLyricsStage;
  if (!el || !stage) {
    return;
  }
  const autopilotOn = Boolean(elements.djAutopilotEnabled?.checked);
  const inPreDropWindow = remainingMs <= 20000 && remainingMs >= 15000;
  if (!autopilotOn || !inPreDropWindow) {
    hideLyricsTransitionOverlay();
    return;
  }
  const nextName = latestRecommendationPlan?.selectedCandidate?.name;
  el.hidden = false;
  el.textContent = nextName
    ? `Transitioning to "${nextName}"…`
    : "Transitioning — next vibe…";
  el.classList.add("is-visible");
  stage.style.opacity = "0.22";
}

function normalizeLyricsText(rawLyrics) {
  return String(rawLyrics ?? "")
    .replace(/\r/g, "\n")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildLyricChunks(rawLyrics) {
  const normalized = normalizeLyricsText(rawLyrics);
  if (!normalized) {
    return [];
  }

  const words = normalized
    .replace(/\n+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks = [];
  let index = 0;
  while (index < words.length) {
    const nextSize = Math.max(3, Math.min(6, words.length > 60 ? 5 : 4));
    chunks.push(words.slice(index, index + nextSize).join(" "));
    index += nextSize;
  }
  return chunks.slice(0, 160);
}

function normalizeTimedLyricLines(rawLines) {
  if (!Array.isArray(rawLines)) {
    return [];
  }
  return rawLines
    .map((line) => {
      const startMsDirect = Number(line?.startMs);
      const timeSec = Number(line?.time ?? line?.timeSeconds);
      let startMs = startMsDirect;
      if (!Number.isFinite(startMs) && Number.isFinite(timeSec)) {
        startMs = timeSec * 1000;
      }
      return {
        startMs,
        text: String(line?.text ?? "").trim()
      };
    })
    .filter((line) => Number.isFinite(line.startMs) && line.startMs >= 0 && line.text.length > 0)
    .sort((a, b) => a.startMs - b.startMs);
}

function pruneLyricsCache() {
  if (lyricsCache.size <= 120) {
    return;
  }
  const oldestEntries = [...lyricsCache.entries()]
    .sort((a, b) => (a[1]?.cachedAtMs ?? 0) - (b[1]?.cachedAtMs ?? 0))
    .slice(0, lyricsCache.size - 90);
  for (const [key] of oldestEntries) {
    lyricsCache.delete(key);
  }
}

function getLyricCacheKey(track) {
  const artist = (track?.artists ?? [])[0]?.name ?? "";
  return `${track?.uri ?? ""}::${track?.name ?? ""}::${artist}`;
}

function applyLyricCaptionForProgress(progressMs, durationMs, isPlaying, remainingMs) {
  const safeDurationMs = Math.max(1, Number(durationMs) || 1);
  const safeProgressRaw = Math.max(0, Math.min(safeDurationMs, Number(progressMs) || 0));
  const remaining =
    remainingMs !== undefined && remainingMs !== null
      ? Math.max(0, Number(remainingMs) || 0)
      : Math.max(0, safeDurationMs - safeProgressRaw);

  updateLyricsTransitionOverlay(remaining);

  if (!elements.nowPlayingLyricCurrent) {
    return;
  }

  const offset = getLyricOffsetMs();
  const adjustedProgress = clamp(safeProgressRaw + offset, 0, safeDurationMs);

  const isLoading =
    activeLyricSource === "loading" ||
    (Boolean(activeLyricFetchTrackUri) && activeLyricFetchTrackUri === activeLyricTrackUri);
  if (isLoading) {
    if (lastLyricVisualFingerprint !== "__loading__") {
      lastLyricVisualFingerprint = "__loading__";
      fadeLyricsPlaceholderLine("Loading lyric captions...", { placeholder: true });
    }
    return;
  }

  const lines = getUnifiedLyricLines(safeDurationMs);
  if (lines.length === 0) {
    const emptyMsg =
      activeLyricSource === "unavailable"
        ? ""
        : "Connect Spotify and hit play — lyrics appear here.";
    const fpEmpty = `empty|${emptyMsg}|${activeLyricSource}`;
    if (fpEmpty !== lastLyricVisualFingerprint) {
      lastLyricVisualFingerprint = fpEmpty;
      fadeLyricsPlaceholderLine(emptyMsg, { placeholder: true });
    }
    return;
  }

  const sig = buildLyricsListSignature(lines, activeLyricTrackUri);
  if (sig !== lyricsListSignature) {
    lyricsListSignature = sig;
    lastLyricVisualFingerprint = "";
  }

  const cur = elements.nowPlayingLyricCurrent;
  if (cur.classList.contains("is-placeholder")) {
    lyricsPlaceholderFadeGeneration += 1;
  }
  cur.classList.remove("is-placeholder");
  cur.style.transition = "none";

  const activeIndex = findLyricDisplayIndex(
    lines,
    adjustedProgress,
    LYRIC_LINE_FADE_IN_MS,
    safeDurationMs
  );
  const line = activeIndex >= 0 ? lines[activeIndex] : null;
  const lineText = line ? String(line.text ?? "").trim() || "\u00a0" : "\u00a0";
  cur.textContent = lineText;
  cur.style.opacity = line ? "1" : "0";
  applyLyricMarqueeAnimation(cur, lineText);
}

function applyLyricMarqueeAnimation(el, text) {
  if (text === lastLyricMarqueeText) {
    return;
  }
  lastLyricMarqueeText = text;
  const durationSec = clamp(text.length * 0.115, 6, 26) + 2;
  el.style.animation = "none";
  // Force reflow so the animation restarts from the beginning for the new line.
  void el.offsetWidth;
  el.style.animation = `heroLyricsMarquee ${durationSec.toFixed(2)}s linear infinite`;
}

async function loadLyricsForTrack(track, accessToken) {
  const trackUri = String(track?.uri ?? "").trim();
  if (!trackUri || !accessToken) {
    activeLyricChunks = [];
    activeTimedLyricLines = [];
    activeLyricSource = "unavailable";
    showLyricsPlaceholderMessage("");
    return;
  }

  if (getSelectedProvider() !== "spotify") {
    activeLyricChunks = [];
    activeTimedLyricLines = [];
    activeLyricSource = "unavailable";
    showLyricsPlaceholderMessage("Synced lyrics are available when Spotify is the provider.");
    return;
  }

  const cacheKey = getLyricCacheKey(track);
  const cached = lyricsCache.get(cacheKey);
  const cacheIsFresh =
    cached && Date.now() - Number(cached.cachedAtMs ?? 0) <= 1000 * 60 * 60 * 6;
  if (cacheIsFresh) {
    if (activeLyricTrackUri === trackUri) {
      activeLyricChunks = Array.isArray(cached.chunks) ? cached.chunks : [];
      activeTimedLyricLines = normalizeTimedLyricLines(cached.timedLines);
      activeLyricSource = cached.source || "cached";
      const d0 = Number(nowPlayingTickerState?.durationMs) || 1;
      const p0 = Math.max(0, Number(nowPlayingTickerState?.baseProgressMs) || 0);
      applyLyricCaptionForProgress(
        p0,
        d0,
        Boolean(nowPlayingTickerState?.isPlaying),
        Math.max(0, d0 - p0)
      );
    }
    return;
  }

  activeLyricFetchTrackUri = trackUri;
  if (activeLyricTrackUri === trackUri) {
    activeLyricChunks = [];
    activeTimedLyricLines = [];
    activeLyricSource = "loading";
    showLyricsPlaceholderMessage("Loading lyric captions...");
  }

  const artistName = (track?.artists ?? [])[0]?.name ?? "";
  const params = new URLSearchParams({
    artist: String(artistName),
    title: String(track?.name ?? "")
  });

  try {
    const payload = await apiRequest(
      `/auth/spotify/lyrics?${params.toString()}`,
      "GET",
      accessToken
    );
    const timedLines = normalizeTimedLyricLines(payload?.timedLines);
    const chunks = payload?.found ? buildLyricChunks(payload?.lyrics ?? "") : [];
    const source = String(payload?.source ?? (payload?.found ? "provider" : "unavailable"));
    lyricsCache.set(cacheKey, {
      cachedAtMs: Date.now(),
      chunks,
      timedLines,
      source
    });
    pruneLyricsCache();

    if (activeLyricTrackUri !== trackUri) {
      return;
    }
    activeLyricChunks = chunks;
    activeTimedLyricLines = timedLines;
    activeLyricSource = source;
    const d1 = Number(nowPlayingTickerState?.durationMs) || 1;
    const p1 = Math.max(0, Number(nowPlayingTickerState?.baseProgressMs) || 0);
    applyLyricCaptionForProgress(
      p1,
      d1,
      Boolean(nowPlayingTickerState?.isPlaying),
      Math.max(0, d1 - p1)
    );
  } catch {
    if (activeLyricTrackUri !== trackUri) {
      return;
    }
    activeLyricChunks = [];
    activeTimedLyricLines = [];
    activeLyricSource = "unavailable";
    showLyricsPlaceholderMessage("");
  } finally {
    if (activeLyricFetchTrackUri === trackUri) {
      activeLyricFetchTrackUri = "";
    }
  }
}

function renderNowPlayingEmpty(message = "Waiting for the Vibe…") {
  stopNowPlayingTicker();
  stopHeroVisualizer();
  resetLyricCaptionFade();
  nowPlayingTickerState = null;
  activeLyricTrackUri = "";
  activeLyricChunks = [];
  activeTimedLyricLines = [];
  activeLyricSource = "waiting";
  activeLyricFetchTrackUri = "";
  activeSongSpectrumTrackId = "";
  activeSongSpectrumSegments = [];
  activeSongSpectrumFetchTrackId = "";
  activeSongSpectrumSegmentIndex = 0;
  setAlbumArt(elements.nowPlayingAlbumArt, null, "");
  setHeroAlbumVisual(null, "");
  elements.nowPlayingTitleHero.textContent = message;
  elements.nowPlayingArtistHero.textContent =
    message === "Waiting for the Vibe…"
      ? "Play something in Spotify to begin."
      : message.includes("Connect Spotify")
        ? "Connect your account, then press play in Spotify."
        : "Playback from Spotify will show up here.";
  elements.nowPlayingAlbumHero.textContent = "";
  showLyricsPlaceholderMessage("Connect Spotify and hit play — lyrics appear here.");
  for (let i = 0; i < heroVisualizerBars.length; i += 1) {
    const bar = heroVisualizerBars[i];
    bar.style.transform = "scaleY(0.12)";
    bar.style.opacity = "0.4";
    paintHeroBarColors(i, 0.12, 0);
  }
  elements.nowPlayingTitle.textContent = message;
  elements.nowPlayingArtist.textContent = "Start a song in Spotify to load details.";
  elements.nowPlayingAlbum.textContent = "";
  elements.nowPlayingProgressBar.style.width = "0%";
  elements.nowPlayingProgressText.textContent = "0:00 / 0:00";
  elements.nowPlayingRemainingText.textContent = "remaining 0:00";
  setPauseResumeButtonLabel(false);
}

function applyNowPlayingProgress(durationMs, progressMs, isPlaying) {
  const safeDurationMs = Math.max(0, Number(durationMs) || 0);
  const safeProgressMs = Math.max(0, Math.min(safeDurationMs, Number(progressMs) || 0));
  const remainingMs = Math.max(0, safeDurationMs - safeProgressMs);
  const progressPercent =
    safeDurationMs > 0
      ? Math.max(0, Math.min(100, (safeProgressMs / safeDurationMs) * 100))
      : 0;

  elements.nowPlayingProgressBar.style.width = `${progressPercent.toFixed(1)}%`;
  elements.nowPlayingProgressText.textContent = `${formatMs(safeProgressMs)} / ${formatMs(
    safeDurationMs
  )}`;
  elements.nowPlayingRemainingText.textContent = isPlaying
    ? `remaining ${formatMs(remainingMs)}`
    : `paused at ${formatMs(safeProgressMs)}`;
  applyLyricCaptionForProgress(safeProgressMs, safeDurationMs, isPlaying, remainingMs);
}

function stopNowPlayingTicker() {
  if (nowPlayingTickerId !== null) {
    window.clearInterval(nowPlayingTickerId);
    nowPlayingTickerId = null;
  }
}

function startNowPlayingTicker() {
  stopNowPlayingTicker();
  nowPlayingTickerId = window.setInterval(() => {
    if (!nowPlayingTickerState?.isPlaying) {
      return;
    }
    const elapsedMs = Date.now() - nowPlayingTickerState.renderedAtMs;
    const projectedProgressMs = nowPlayingTickerState.baseProgressMs + elapsedMs;
    applyNowPlayingProgress(
      nowPlayingTickerState.durationMs,
      projectedProgressMs,
      true
    );
  }, 250);
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
  const isPlaying = Boolean(playback?.is_playing);

  setAlbumArt(
    elements.nowPlayingAlbumArt,
    item.album?.images?.[0]?.url ?? item.album?.images?.[1]?.url ?? null,
    `${item.name} album art`
  );
  setHeroAlbumVisual(
    item.album?.images?.[0]?.url ?? item.album?.images?.[1]?.url ?? null,
    `${item.name} cover art`
  );
  elements.nowPlayingTitleHero.textContent = item.name || "Unknown track";
  elements.nowPlayingArtistHero.textContent = artistText || "Unknown artist";
  elements.nowPlayingAlbumHero.textContent = item.album?.name
    ? `Album: ${item.album.name}`
    : "";
  elements.nowPlayingTitle.textContent = item.name || "Unknown track";
  elements.nowPlayingArtist.textContent = artistText || "Unknown artist";
  elements.nowPlayingAlbum.textContent = item.album?.name
    ? `Album: ${item.album.name}`
    : "";
  const trackUri = String(item.uri ?? "").trim();
  const trackId = extractSpotifyTrackIdFromItem(item);
  if (trackUri && trackUri !== activeLyricTrackUri) {
    resetLyricCaptionFade();
    activeLyricTrackUri = trackUri;
    activeLyricChunks = [];
    activeTimedLyricLines = [];
    activeLyricSource = "loading";
    showLyricsPlaceholderMessage("Loading lyric captions...");
    loadLyricsForTrack(item, elements.accessToken.value.trim());
  }
  if (trackId && trackId !== activeSongSpectrumTrackId) {
    activeSongSpectrumTrackId = trackId;
    activeSongSpectrumSegments = [];
    activeSongSpectrumFetchTrackId = trackId;
    activeSongSpectrumSegmentIndex = 0;
    loadSongSpectrumForTrack(item, elements.accessToken.value.trim());
  }
  applyNowPlayingProgress(durationMs, progressMs, isPlaying);
  setPauseResumeButtonLabel(isPlaying);

  nowPlayingTickerState = {
    trackUri: item.uri ?? "",
    trackId,
    trackSeed: hashStringToInt(trackUri || trackId || "track"),
    durationMs,
    baseProgressMs: progressMs,
    isPlaying,
    renderedAtMs: Date.now()
  };
  startHeroVisualizer();
  if (isPlaying) {
    startNowPlayingTicker();
  } else {
    stopNowPlayingTicker();
  }
}

async function getPlaybackState(
  accessToken,
  { force = false, cacheTtlMs = PLAYBACK_STATE_CACHE_TTL_MS } = {}
) {
  const token = String(accessToken ?? "").trim();
  if (!token) {
    throw new Error("Missing access token for playback state.");
  }

  const isFresh =
    !force &&
    playbackStateCache.payload &&
    playbackStateCache.token === token &&
    Date.now() - playbackStateCache.fetchedAtMs <= Math.max(0, cacheTtlMs);
  if (isFresh) {
    return playbackStateCache.payload;
  }

  if (playbackStateInFlight?.token === token) {
    return playbackStateInFlight.promise;
  }

  const promise = apiRequest("/auth/spotify/player/current", "GET", token)
    .then((payload) => {
      playbackStateCache = {
        token,
        fetchedAtMs: Date.now(),
        payload
      };
      return payload;
    })
    .finally(() => {
      if (playbackStateInFlight?.token === token) {
        playbackStateInFlight = null;
      }
    });
  playbackStateInFlight = { token, promise };
  return promise;
}

async function refreshNowPlaying({ silent = false } = {}) {
  if (nowPlayingInFlight) {
    return;
  }

  nowPlayingInFlight = true;

  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    renderNowPlayingEmpty("Spotify only — switch provider in System config.");
    nowPlayingInFlight = false;
    return;
  }

  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) {
    renderNowPlayingEmpty("Connect Spotify to see what’s playing.");
    nowPlayingInFlight = false;
    return;
  }

  try {
    const payload = await getPlaybackState(accessToken);
    renderNowPlaying(payload);
  } catch (error) {
    if (!silent) {
      logStatus(`Could not refresh now playing: ${error.message}`);
    }
    renderNowPlayingEmpty("Couldn’t load playback — try Refresh.");
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

function getNowPlayingPollIntervalMs() {
  const shouldUseFastPolling =
    Boolean(pendingFlowInjection) ||
    Boolean(pollingIntervalId) ||
    elements.djAutopilotEnabled.checked;
  return shouldUseFastPolling
    ? NOW_PLAYING_POLL_ACTIVE_MS
    : NOW_PLAYING_POLL_IDLE_MS;
}

function startNowPlayingPolling() {
  stopNowPlayingPolling();
  const intervalMs = getNowPlayingPollIntervalMs();
  nowPlayingIntervalId = window.setInterval(() => {
    refreshNowPlaying({ silent: true });
  }, intervalMs);
}

function restartNowPlayingPolling() {
  if (!isProviderSupported(getSelectedProvider())) {
    stopNowPlayingPolling();
    return;
  }
  startNowPlayingPolling();
}

function updateDjAutopilotStatus(message = "") {
  if (message) {
    elements.djAutopilotStatus.textContent = message;
    return;
  }

  if (!elements.djAutopilotEnabled.checked) {
    elements.djAutopilotStatus.textContent =
      "Autopilot is off. Enable it to auto-queue transitions 15-20 seconds before track end.";
    return;
  }

  elements.djAutopilotStatus.textContent =
    "Autopilot is on. It will queue a new vibe in the 15-20 second pre-drop window.";
}

async function syncDjSessionMode() {
  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    return;
  }
  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) {
    return;
  }

  try {
    await apiRequest("/auth/spotify/dj/session/start", "POST", accessToken, {
      sessionId: getOrCreateDjSessionId(),
      remixModeEnabled: elements.djRemixMode.checked
    });
  } catch (error) {
    logStatus(`Could not sync DJ session mode: ${error.message}`);
  }
}

async function runAutopilotTick() {
  if (autoplayInFlight || !elements.djAutopilotEnabled.checked) {
    return;
  }
  autoplayInFlight = true;

  try {
    const provider = getSelectedProvider();
    if (!isProviderSupported(provider)) {
      return;
    }

    const accessToken = elements.accessToken.value.trim();
    if (!accessToken) {
      return;
    }

    const playbackState = await getPlaybackState(accessToken, {
      force: true,
      cacheTtlMs: 250
    });
    const playback = playbackState?.playback;
    const track = playback?.item;
    if (!playbackState?.hasActivePlayback || !track) {
      return;
    }

    const remainingMs = Math.max(
      0,
      (Number(track.duration_ms) || 0) - (Number(playback.progress_ms) || 0)
    );
    const currentUri = track.uri;
    const inTriggerWindow = remainingMs <= 20000 && remainingMs >= 15000;

    if (!inTriggerWindow) {
      return;
    }
    if (!currentUri || currentUri === lastAutoplayTriggerTrackUri) {
      return;
    }

    const plan = await apiRequest(
      "/auth/spotify/dj/recommend/next",
      "POST",
      accessToken,
      {
        sessionId: getOrCreateDjSessionId(),
        userContext: buildUserContext()
      }
    );
    if (!plan?.selectedCandidate?.uri) {
      return;
    }

    renderRecommendationPlan(plan);
    applyRecommendationToInputs();
    await handleQueueAction({
      forceQueueOnly: false,
      trackUriOverride: plan.selectedCandidate.uri
    });
    lastAutoplayTriggerTrackUri = currentUri;
    logStatus(
      `Autopilot queued ${plan.selectedCandidate.name} in pre-drop window.`
    );
  } catch (error) {
    logStatus(`Autopilot tick failed: ${error.message}`);
  } finally {
    autoplayInFlight = false;
  }
}

function stopDjAutopilotLoop() {
  if (autoplayIntervalId !== null) {
    window.clearInterval(autoplayIntervalId);
    autoplayIntervalId = null;
  }
  restartNowPlayingPolling();
}

function startDjAutopilotLoop() {
  stopDjAutopilotLoop();
  autoplayIntervalId = window.setInterval(() => {
    runAutopilotTick();
  }, 1500);
  restartNowPlayingPolling();
}

function stopFlowInjectionWatcher() {
  if (flowInjectionWatcherId !== null) {
    window.clearInterval(flowInjectionWatcherId);
    flowInjectionWatcherId = null;
  }
  restartNowPlayingPolling();
}

async function runFlowInjectionWatcherTick() {
  if (flowInjectionInFlight || !pendingFlowInjection) {
    return;
  }
  flowInjectionInFlight = true;

  try {
    const accessToken = elements.accessToken.value.trim();
    if (!accessToken) {
      return;
    }

    const playbackState = await getPlaybackState(accessToken, {
      force: true,
      cacheTtlMs: 200
    });
    const currentUri = playbackState?.playback?.item?.uri;
    if (!currentUri) {
      return;
    }

    if (currentUri === pendingFlowInjection.targetTrackUri) {
      lastInjectedAiTrackId = pendingFlowInjection.targetTrackId;
      logStatus(`Flow injection landed: ${pendingFlowInjection.targetTrackName}.`);
      setActionInlineStatus("Flow injection landed on target track.", "success");
      pendingFlowInjection = null;
      stopFlowInjectionWatcher();
      return;
    }

    if (currentUri !== pendingFlowInjection.sourceTrackUri) {
      logStatus(
        `Flow injection canceled: playback changed before target landed (${pendingFlowInjection.targetTrackName}).`
      );
      setFlowInjectionIndicator("Flow injection canceled");
      pendingFlowInjection = null;
      stopFlowInjectionWatcher();
    }
  } catch (error) {
    logStatus(`Flow injection watcher failed: ${error.message}`);
    setActionInlineStatus(`Flow injection watcher failed: ${error.message}`, "error");
  } finally {
    flowInjectionInFlight = false;
  }
}

function startFlowInjectionWatcher() {
  stopFlowInjectionWatcher();
  flowInjectionWatcherId = window.setInterval(() => {
    runFlowInjectionWatcherTick();
  }, 900);
  restartNowPlayingPolling();
}

async function armFlowInjectionForPlan(plan, bpmMatchPercent) {
  const accessToken = elements.accessToken.value.trim();
  const selected = plan?.selectedCandidate;
  const current = plan?.currentTrack;
  if (!accessToken || !selected?.uri || !current?.uri) {
    throw new Error("Missing recommendation or playback context for flow injection.");
  }

  const deviceId = elements.deviceId.value.trim();
  const positionMs = Math.max(
    0,
    Math.round(
      Number(plan?.transitionPlan?.recommendedOffsetMs ?? plan?.entryPoint?.recommendedOffsetMs ?? 0)
    )
  );

  const flowQueueResult = await apiRequest("/auth/spotify/player/queue", "POST", accessToken, {
    trackUri: selected.uri,
    deviceId: deviceId || undefined
  });
  persistResolvedSpotifyDevice(flowQueueResult);

  pendingFlowInjection = {
    sourceTrackUri: current.uri,
    targetTrackUri: selected.uri,
    targetTrackId: selected.id,
    targetTrackName: selected.name ?? selected.uri,
    positionMs,
    deviceId: flowQueueResult?.deviceId || deviceId || null
  };

  setFlowInjectionIndicator(`Flow boost · ${Math.round(bpmMatchPercent)}% BPM match`);
  setActionInlineStatus(
    `Flow injection armed (${Math.round(bpmMatchPercent)}% BPM match).`,
    "success"
  );
  logStatus(
    `Flow injection armed: ${selected.name} queued as next transition target.`
  );
  startFlowInjectionWatcher();
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

function clearRecommendationUi(message) {
  latestRecommendationPlan = null;
  elements.recommendationPrimary.classList.add("hidden");
  elements.recommendationCandidates.innerHTML = "";
  elements.recommendationStatus.textContent = message;
  setRecommendationInlineStatus("");
  setFlowInjectionIndicator("");
  elements.recommendationScoreNote.textContent = "";
  elements.recommendationScoreNote.classList.add("hidden");
  if (elements.vibeMatchBlock) {
    elements.vibeMatchBlock.classList.add("hidden");
  }
  if (elements.vibeMatchFill) {
    elements.vibeMatchFill.style.width = "0%";
  }
  if (elements.vibeMatchValue) {
    elements.vibeMatchValue.textContent = "—";
  }
  elements.vibeMatchMeter?.classList.remove("glow-high");
  if (elements.recommendationEraBadge) {
    elements.recommendationEraBadge.textContent = "";
    elements.recommendationEraBadge.classList.add("hidden");
  }
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
  const vibeScore = clamp(Math.round(Number(selected.score) || 0), 0, 100);
  elements.recommendationScoreChip.textContent = `Vibe match ${vibeScore}/100`;
  elements.recommendationOffsetChip.textContent = `Start ~${entryPoint.recommendedOffsetSeconds}s`;
  elements.recommendationPrimary.classList.remove("hidden");

  if (elements.vibeMatchBlock) {
    elements.vibeMatchBlock.classList.remove("hidden");
  }
  if (elements.vibeMatchFill) {
    elements.vibeMatchFill.style.width = `${vibeScore}%`;
  }
  if (elements.vibeMatchValue) {
    elements.vibeMatchValue.textContent = `${vibeScore}%`;
  }
  elements.vibeMatchMeter?.classList.toggle("glow-high", vibeScore >= 80);

  const tv = selected.temporalVibe;
  if (elements.recommendationEraBadge) {
    if (tv?.eraLabel) {
      const align = Number.isFinite(tv.eraAlignmentPercent)
        ? ` · ${tv.eraAlignmentPercent}%`
        : "";
      elements.recommendationEraBadge.textContent = `Era match: ${tv.eraLabel}${align}`;
      elements.recommendationEraBadge.classList.remove("hidden");
    } else {
      elements.recommendationEraBadge.textContent = "";
      elements.recommendationEraBadge.classList.add("hidden");
    }
  }

  elements.recommendationScoreNote.textContent = "";
  elements.recommendationScoreNote.classList.add("hidden");

  elements.recommendationStatus.textContent = `Found a strong fit among ${plan?.candidateSelection?.totalCandidates ?? 0} ideas — ${selected.name}.`;

  if (!pendingFlowInjection) {
    setFlowInjectionIndicator("");
  }

  elements.recommendationCandidates.innerHTML = "";
  (plan.topCandidates ?? []).forEach((candidate, index) => {
    const item = document.createElement("div");
    item.className = "candidate-item";
    const artists = (candidate.artistNames ?? []).join(", ");
    item.textContent = `${index + 1}. ${candidate.name} — ${artists} · ${candidate.score}/100 vibe`;
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

function reorderAiSuggestionsAfterSkip(skipTrackId) {
  if (!latestRecommendationPlan?.topCandidates?.length) {
    return [];
  }

  const list = [...latestRecommendationPlan.topCandidates];
  const selected = latestRecommendationPlan.selectedCandidate;
  const nonSkipped = list.filter((item) => item.id !== skipTrackId);
  if (nonSkipped.length < 3) {
    return [];
  }

  const moved = nonSkipped.slice(0, 2);
  const remained = nonSkipped.slice(2);
  const reordered = [...remained, ...moved];

  latestRecommendationPlan = {
    ...latestRecommendationPlan,
    selectedCandidate: reordered[0] ?? selected,
    topCandidates: reordered
  };
  renderRecommendationPlan(latestRecommendationPlan);
  return moved.map((item) => item.name ?? item.uri);
}

function applyRecommendationToInputs() {
  const selected = latestRecommendationPlan?.selectedCandidate;
  const transitionPlan = latestRecommendationPlan?.transitionPlan;
  if (!selected || !transitionPlan) {
    throw new Error("Generate a vibe first.");
  }

  setTrackInput(selected.uri);
  elements.offsetSeconds.value = String(transitionPlan.recommendedOffsetSeconds);
  elements.seekDelaySeconds.value = String(
    transitionPlan.recommendedSeekDelaySeconds
  );
  if (Number.isFinite(transitionPlan.crossfadeDurationMs)) {
    const sec = Math.max(0.2, transitionPlan.crossfadeDurationMs / 1000);
    elements.smoothFadeSeconds.value = String(Math.round(sec * 10) / 10);
  }
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
  localStorage.setItem(
    DJ_REMIX_MODE_KEY,
    elements.djRemixMode.checked ? "true" : "false"
  );
  localStorage.setItem(
    DJ_AUTOPILOT_ENABLED_KEY,
    elements.djAutopilotEnabled.checked ? "true" : "false"
  );
  localStorage.setItem(
    CONTEXT_MOOD_LEVEL_KEY,
    String(Math.round(Number(elements.contextMoodLevel.value || 50)))
  );
  if (elements.contextNostalgiaSlider) {
    localStorage.setItem(
      CONTEXT_NOSTALGIA_SLIDER_KEY,
      String(Math.round(Number(elements.contextNostalgiaSlider.value || 50)))
    );
  }
  if (elements.lyricOffsetMs) {
    localStorage.setItem(LYRIC_OFFSET_MS_KEY, String(Number(elements.lyricOffsetMs.value) || 0));
  }
  localStorage.setItem(LISTENER_AGE_KEY, elements.listenerAge.value.trim());
  localStorage.setItem(LISTENER_GENDER_KEY, elements.listenerGender.value);
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
  elements.djRemixMode.checked =
    (localStorage.getItem(DJ_REMIX_MODE_KEY) ?? "false") === "true";
  elements.djAutopilotEnabled.checked =
    (localStorage.getItem(DJ_AUTOPILOT_ENABLED_KEY) ?? "false") === "true";
  elements.contextMoodLevel.value = localStorage.getItem(CONTEXT_MOOD_LEVEL_KEY) ?? "50";
  if (elements.contextNostalgiaSlider) {
    elements.contextNostalgiaSlider.value =
      localStorage.getItem(CONTEXT_NOSTALGIA_SLIDER_KEY) ?? "50";
  }
  if (elements.lyricOffsetMs) {
    const savedOff = localStorage.getItem(LYRIC_OFFSET_MS_KEY);
    elements.lyricOffsetMs.value =
      savedOff !== null && savedOff !== "" ? String(savedOff) : "0";
  }
  localStorage.removeItem("spotify_helper_context_gender");
  localStorage.removeItem("spotify_helper_context_account_age_years");
  elements.listenerAge.value = localStorage.getItem(LISTENER_AGE_KEY) ?? "";
  elements.listenerGender.value = localStorage.getItem(LISTENER_GENDER_KEY) ?? "unspecified";
  updateLocationStatusFromStorage();
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
  refreshSpotifyProfileContext({ silent: true });
  loadPersonalizationData({ silent: true });
  if (hashAuthError) {
    logStatus(`Spotify connect failed: ${hashAuthError}`);
    setActionInlineStatus(`Spotify connect failed: ${hashAuthError}`, "error");
  } else if (hashAuthStatus === "success" && (accessToken || refreshToken)) {
    logStatus("Spotify connected. Tokens imported automatically.");
    setActionInlineStatus("Spotify connected and ready.", "success");
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
    return;
  }

  setActionButtonsDisabled(false);
}

function updateProviderUi() {
  const provider = getSelectedProvider();
  const providerSupported = isProviderSupported(provider);
  const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
  const hasAccessToken = Boolean(elements.accessToken.value.trim());

  elements.accessTokenLabel.textContent = `${providerName} Access Token`;
  elements.connectSpotifyButtonLabel.textContent =
    hasAccessToken && providerSupported ? "Reconnect Spotify" : "Connect Spotify";
  elements.connectSpotifyHint.textContent =
    hasAccessToken && providerSupported
      ? "Connected. Reconnect if you want to refresh scopes or switch accounts."
      : "Recommended first step. You only need to authorize once.";

  if (providerSupported) {
    elements.providerStatus.textContent =
      "Spotify support is active. SoundCloud, Apple Music, YouTube Music, and Tidal UI is staged for future integration.";
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
  elements.queueFromUriButton.disabled = !providerSupported;
  elements.trackSearchQuery.disabled = !providerSupported;
  elements.searchTracksButton.disabled = !providerSupported;
  elements.deviceId.disabled = !providerSupported;
  elements.refreshNowPlayingButton.disabled = !providerSupported;
  elements.djRemixMode.disabled = !providerSupported;
  elements.djAutopilotEnabled.disabled = !providerSupported;
  elements.contextMoodLevel.disabled = !providerSupported;
  if (elements.contextNostalgiaSlider) {
    elements.contextNostalgiaSlider.disabled = !providerSupported;
  }
  if (elements.lyricOffsetMs) {
    elements.lyricOffsetMs.disabled = !providerSupported;
  }

  if (!providerSupported) {
    clearSearchResults(
      `${providerName} search is coming soon. Switch to Spotify for live search.`
    );
    clearRecommendationUi(`${providerName} recommendation engine is coming soon.`);
    pendingFlowInjection = null;
    stopFlowInjectionWatcher();
    invalidatePlaybackStateCache();
    teardownAudioReactiveVisualizer();
    stopNowPlayingTicker();
    renderNowPlayingEmpty("Spotify only — switch provider in System config.");
    stopNowPlayingPolling();
    stopDjAutopilotLoop();
    setSearchInlineStatus("");
    setRecommendationInlineStatus("");
    setActionInlineStatus("");
  } else {
    if (!latestRecommendationPlan && elements.recommendationStatus.textContent.trim() === "") {
      elements.recommendationStatus.textContent = "Generate a vibe to see your next best track.";
    }
    startNowPlayingPolling();
    if (elements.djAutopilotEnabled.checked) {
      startDjAutopilotLoop();
    }
    if (!hasAccessToken) {
      setActionInlineStatus("Connect Spotify to unlock search, queue, and AI transitions.", "info");
    }
  }

  updateAutoSeekUi();
  updateDjAutopilotStatus();
  updateRecommendationButtons();
  updateSmartQueueButtons();
  updatePlatformBetaBanner();
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
  const djSessionId = getOrCreateDjSessionId();
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-DJ-Session-ID": djSessionId
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

const universalPlayer = new UniversalPlayer("spotify", apiRequest);

function scheduleAutoSearch() {
  if (searchDebounceTimerId !== null) {
    window.clearTimeout(searchDebounceTimerId);
    searchDebounceTimerId = null;
  }

  const query = elements.trackSearchQuery.value.trim();
  if (!query) {
    clearSearchResults("Search for a song or paste a Spotify link.");
    setSearchInlineStatus("");
    return;
  }

  tryAutoSelectProviderFromText(query);
  if (!isProviderSupported(getSelectedProvider())) {
    clearSearchResults("Search isn’t available for this platform yet.");
    setSearchInlineStatus("BETA: pick Spotify in System config to search.", "info");
    return;
  }

  const directUri = normalizeTrackUri(query);
  if (directUri) {
    clearSearchResults("Spotify link detected.");
    setSearchInlineStatus("Link ready — use Queue or Play under Now playing.", "info");
    return;
  }

  if (query.length < 2) {
    clearSearchResults("Keep typing to search...");
    setSearchInlineStatus("Keep typing to search.", "info");
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
      setSearchInlineStatus("Search already running. Queuing next search...", "info");
    }
    return;
  }

  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
    clearSearchResults(`${providerName} search is coming soon.`);
    setSearchInlineStatus(`${providerName} search is not available yet.`, "error");
    return;
  }

  const accessToken = elements.accessToken.value.trim();
  const query = elements.trackSearchQuery.value.trim();

  if (!accessToken) {
    clearSearchResults("Connect Spotify in Settings, then search.");
    setSearchInlineStatus("Connect Spotify first to search.", "error");
    return;
  }

  if (!query) {
    clearSearchResults("Type a song name, artist, or keyword to search.");
    setSearchInlineStatus("Enter a song or artist first.", "info");
    return;
  }

  tryAutoSelectProviderFromText(query);
  if (!isProviderSupported(getSelectedProvider())) {
    clearSearchResults("Search isn’t wired for this platform yet.");
    setSearchInlineStatus("BETA: switch to Spotify in System config to search.", "info");
    return;
  }

  const directUri = normalizeTrackUri(query);
  if (directUri) {
    setTrackInput(directUri);
    clearSearchResults("Spotify link saved for queue actions.");
    setSearchInlineStatus("Link ready — use Queue or Play under Now playing.", "success");
    logStatus(`Captured track link ${directUri}.`);
    return;
  }

  searchInFlight = true;
  elements.searchTracksButton.disabled = true;
  clearSearchResults("Searching tracks...");
  setSearchInlineStatus("Searching tracks...", "info");

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
    setSearchInlineStatus(
      `Found ${payload?.tracks?.length ?? 0} track(s).`,
      "success"
    );
    logStatus(
      `Search "${query}" returned ${payload?.tracks?.length ?? 0} track(s).`
    );
    try {
      await apiRequest(
        "/auth/spotify/dj/session/affinity/search",
        "POST",
        accessToken,
        {
          sessionId: getOrCreateDjSessionId(),
          query
        }
      );
    } catch (feedbackError) {
      logStatus(`Could not save search affinity: ${feedbackError.message}`);
    }
  } catch (error) {
    clearSearchResults(`Search failed: ${error.message}`);
    setSearchInlineStatus(`Search failed: ${error.message}`, "error");
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
  restartNowPlayingPolling();
}

async function waitMs(durationMs) {
  await new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

async function setPlaybackVolume(accessToken, volumePercent, deviceId) {
  await universalPlayer.setVolume(accessToken, volumePercent, deviceId);
}

async function fadeVolume({
  accessToken,
  fromVolumePercent,
  toVolumePercent,
  durationMs,
  deviceId
}) {
  const delta = Math.abs((Number(toVolumePercent) || 0) - (Number(fromVolumePercent) || 0));
  const safeDurationMs = Math.max(0, Number(durationMs) || 0);
  if (safeDurationMs <= 220 || delta <= 4) {
    await setPlaybackVolume(accessToken, toVolumePercent, deviceId);
    return;
  }

  // Keep API calls low to avoid volume endpoint throttling.
  const steps = Math.max(2, Math.min(5, Math.round(safeDurationMs / 360)));
  const stepDelayMs = Math.max(120, Math.round(safeDurationMs / steps));

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
  const transitionPlan =
    latestRecommendationPlan?.selectedCandidate?.uri === pendingTarget.trackUri
      ? latestRecommendationPlan?.transitionPlan
      : null;
  const duck = transitionPlan?.mockDuckProfile;
  const outgoingRatio = Number(duck?.outgoingEndRatio);
  const dippedVolume = Math.max(
    8,
    Math.round(baseVolume * (Number.isFinite(outgoingRatio) ? outgoingRatio : 0.35))
  );
  const volDelta = Number(transitionPlan?.volumeNormalizationPercentDelta);
  const endVolume = clamp(
    baseVolume + (Number.isFinite(volDelta) ? volDelta : 0),
    5,
    100
  );

  logStatus(
    `Applying DJ fade (${Math.round(fadeDurationMs / 1000)}s) · ${
      transitionPlan?.transitionLabel ?? "transition"
    } before seek.`
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

  await universalPlayer.seek(
    accessToken,
    pendingTarget.desiredOffsetMs,
    pendingTarget.deviceId
  );
  invalidatePlaybackStateCache();

  await waitMs(220);

  try {
    await fadeVolume({
      accessToken,
      fromVolumePercent: dippedVolume,
      toVolumePercent: endVolume,
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
    invalidatePlaybackStateCache();
  }

  const verifyWaitsMs = [800, 1300, 1900];
  const maxAllowedDriftMs = 5500;
  let lastReportedProgressMs = null;
  let lastDriftMs = null;

  for (const waitDurationMs of verifyWaitsMs) {
    await waitMs(waitDurationMs);
    const playbackState = await getPlaybackState(accessToken, {
      force: true,
      cacheTtlMs: 0
    });
    const currentUri = playbackState?.playback?.item?.uri;
    const progressMs = Number(playbackState?.playback?.progress_ms);

    if (currentUri !== pendingTarget.trackUri) {
      throw new Error("Queued track changed before seek could be verified.");
    }

    if (!Number.isFinite(progressMs)) {
      continue;
    }

    lastReportedProgressMs = progressMs;
    const driftMs = Math.abs(progressMs - pendingTarget.desiredOffsetMs);
    lastDriftMs = driftMs;
    if (driftMs <= maxAllowedDriftMs) {
      logStatus(`Seek verified near ${formatMs(pendingTarget.desiredOffsetMs)}.`);
      clearPendingQueueTarget();
      hideFallback();
      stopPolling();
      setActionInlineStatus("Auto-seek verified.", "success");
      return;
    }
  }

  const driftSeconds =
    lastDriftMs === null ? "unknown" : String(Math.round(lastDriftMs / 1000));
  const reportedAt = Number.isFinite(lastReportedProgressMs)
    ? formatMs(lastReportedProgressMs)
    : "unknown";
  throw new Error(
    `Spotify playback state lagged after seek (drift ${driftSeconds}s, reported ${reportedAt}). Audio may still be correct.`
  );
}

function startPollingForQueuedTrack(pendingTarget, accessToken) {
  stopPolling();
  restartNowPlayingPolling();

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
      const playbackState = await getPlaybackState(accessToken, {
        force: true,
        cacheTtlMs: 0
      });

      if (!playbackState?.hasActivePlayback || !playbackState?.playback) {
        if (!hasLoggedWaitingForDevice) {
          logStatus("Waiting for active Spotify playback device...");
          setActionInlineStatus("Waiting for active Spotify device...", "info");
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
        setActionInlineStatus(
          "Timed out waiting for queue handoff. Try manual fallback timestamp.",
          "error"
        );
        logStatus("Timed out before queued track became current.");
      }
    } catch (error) {
      stopPolling();
      showFallback(
        `Auto-seek could not be verified: ${error.message}`,
        pendingTarget.desiredOffsetMs
      );
      setActionInlineStatus(
        `Auto-seek verification issue: ${error.message}`,
        "error"
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
  setActionInlineStatus("Queueing track...", "info");

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

    const queueResult = await apiRequest("/auth/spotify/player/queue", "POST", accessToken, {
      trackUri,
      deviceId: deviceId || undefined
    });
    persistResolvedSpotifyDevice(queueResult);
    clearSearchUiAfterQueue({ preserveResults: true });
    logStatus("Search results kept so you can queue multiple tracks faster.");

    if (!shouldAutoSeek) {
      clearPendingQueueTarget();
      stopPolling();
      hideFallback();
      invalidatePlaybackStateCache();
      refreshNowPlaying({ silent: true });
      setActionInlineStatus("Track queued. Native Spotify transition preserved.", "success");
      logStatus(
        `Queued ${trackUri}. No auto-seek, so Spotify native transition behavior is preserved.`
      );
      return;
    }

    const pendingTarget = {
      trackUri,
      desiredOffsetMs,
      seekDelayMs,
      deviceId: queueResult?.deviceId || deviceId || null,
      smoothTransitionEnabled,
      smoothFadeDurationMs,
      mustSeeDifferentTrackFirst: false,
      seenDifferentTrackYet: false,
      createdAtMs: Date.now()
    };

    try {
      const playbackState = await getPlaybackState(accessToken, { force: true, cacheTtlMs: 0 });
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
    restartNowPlayingPolling();
    setActionInlineStatus("Queued. Watching for target track to auto-seek.", "info");
    logStatus(`Queued ${trackUri}. Watching for track to become current...`);
    startPollingForQueuedTrack(pendingTarget, accessToken);
  } catch (error) {
    logStatus(`Could not start queue flow: ${error.message}`);
    setActionInlineStatus(`Queue flow failed: ${error.message}`, "error");
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

async function handleQueueFromUriClick() {
  await handleQueueAction({ forceQueueOnly: true });
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

/** After play/queue, server may resolve a Connect device — save for next calls. */
function persistResolvedSpotifyDevice(apiResult) {
  const id = apiResult?.deviceId;
  if (!id || typeof id !== "string" || !elements.deviceId) {
    return;
  }
  elements.deviceId.value = id;
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

async function handleQuickPauseResumeClick() {
  setActionButtonsDisabled(true);
  setActionInlineStatus("Updating playback...", "info");
  try {
    const { accessToken, deviceId } = getQuickTransportContext();
    const playbackState = await getPlaybackState(accessToken, { force: true, cacheTtlMs: 0 });
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
    invalidatePlaybackStateCache();
    logStatus(isPlaying ? "Paused playback." : "Resumed playback.");
    setActionInlineStatus(isPlaying ? "Playback paused." : "Playback resumed.", "success");
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    logStatus(`Could not toggle pause/resume: ${error.message}`);
    setActionInlineStatus(`Pause/resume failed: ${error.message}`, "error");
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handleQuickNextClick() {
  setActionButtonsDisabled(true);
  setActionInlineStatus("Skipping to next track...", "info");
  try {
    const { accessToken, deviceId } = getQuickTransportContext();
    try {
      const playbackState = await getPlaybackState(accessToken, { force: true, cacheTtlMs: 0 });
      const current = playbackState?.playback?.item;
      const progressMs = Number(playbackState?.playback?.progress_ms) || 0;
      if (current?.id && progressMs <= 30000) {
        await apiRequest(
          "/auth/spotify/dj/session/feedback/skip",
          "POST",
          accessToken,
          {
            sessionId: getOrCreateDjSessionId(),
            trackId: current.id,
            artistIds: (current.artists ?? []).map((artist) => artist.id),
            progressMs
          }
        );
        logStatus("Skip feedback captured (early skip).");

        const isAiInjectedTrack =
          current.id === lastInjectedAiTrackId ||
          current.id === latestRecommendationPlan?.selectedCandidate?.id;
        if (isAiInjectedTrack) {
          const moved = reorderAiSuggestionsAfterSkip(current.id);
          if (moved.length > 0) {
            logStatus(
              `Vibe shift learned. Moved next AI suggestions to back: ${moved.join(", ")}.`
            );
            setFlowInjectionIndicator("Flow updated after skip");
          }
        }
      }
    } catch (feedbackError) {
      logStatus(`Skip feedback not captured: ${feedbackError.message}`);
    }
    await apiRequest("/auth/spotify/player/next", "POST", accessToken, {
      deviceId: deviceId || undefined
    });
    invalidatePlaybackStateCache();
    logStatus("Skipped to next track.");
    setActionInlineStatus("Skipped to next track.", "success");
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    logStatus(`Could not skip to next track: ${error.message}`);
    setActionInlineStatus(`Skip failed: ${error.message}`, "error");
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handleQuickPreviousClick() {
  setActionButtonsDisabled(true);
  setActionInlineStatus("Going to previous track...", "info");
  try {
    const { accessToken, deviceId } = getQuickTransportContext();
    await apiRequest("/auth/spotify/player/previous", "POST", accessToken, {
      deviceId: deviceId || undefined
    });
    invalidatePlaybackStateCache();
    logStatus("Went to previous track.");
    setActionInlineStatus("Moved to previous track.", "success");
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    logStatus(`Could not go to previous track: ${error.message}`);
    setActionInlineStatus(`Previous failed: ${error.message}`, "error");
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handlePlayNowClick(trackUriOverride = null) {
  hideFallback();
  saveInputsToLocalStorage();
  setActionButtonsDisabled(true);
  setActionInlineStatus("Starting playback...", "info");

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

    const playResult = await apiRequest("/auth/spotify/player/play-now", "PUT", accessToken, {
      trackUri,
      deviceId: deviceId || undefined,
      positionMs
    });
    persistResolvedSpotifyDevice(playResult);
    invalidatePlaybackStateCache();

    stopPolling();
    clearPendingQueueTarget();
    clearSearchUiAfterQueue();
    hideFallback();
    setActionInlineStatus("Now playing.", "success");
    logStatus(`Playing now: ${trackUri} at ${formatMs(positionMs)}.`);
  } catch (error) {
    const parsedOffset = Number(elements.offsetSeconds.value);
    const positionMs =
      Number.isFinite(parsedOffset) && parsedOffset >= 0
        ? Math.round(parsedOffset * 1000)
        : 0;
    logStatus(`Could not start play-now flow: ${error.message}`);
    setActionInlineStatus(`Play now failed: ${error.message}`, "error");
    showFallback(`Play-now failed: ${error.message}`, positionMs);
  } finally {
    setActionButtonsDisabled(false);
    updateProviderUi();
  }
}

async function handleManualRefreshTokenClick() {
  elements.refreshTokenButton.disabled = true;
  setActionInlineStatus("Refreshing access token...", "info");
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
    invalidatePlaybackStateCache();
    refreshSpotifyProfileContext({ silent: true });
    logStatus("Access token refreshed.");
    setActionInlineStatus("Access token refreshed.", "success");
  } catch (error) {
    logStatus(`Could not refresh access token: ${error.message}`);
    setActionInlineStatus(`Token refresh failed: ${error.message}`, "error");
    showFallback(`Token refresh failed: ${error.message}`, 0);
  } finally {
    updateProviderUi();
  }
}

async function handleRefreshNowPlayingClick() {
  elements.refreshNowPlayingButton.disabled = true;
  setActionInlineStatus("Refreshing now playing...", "info");
  try {
    invalidatePlaybackStateCache();
    await refreshNowPlaying({ silent: false });
    setActionInlineStatus("Now playing refreshed.", "success");
  } catch (error) {
    setActionInlineStatus(`Refresh failed: ${error.message}`, "error");
  } finally {
    updateProviderUi();
  }
}

async function handleEnableLiveSpectrumClick() {
  if (hasSongSpectrum()) {
    setActionInlineStatus(
      "Song analyzer is already active. Live mic pickup is optional.",
      "info"
    );
    return;
  }
  if (hasLiveAudioSpectrum()) {
    return;
  }
  setActionInlineStatus("Enabling optional live sound pickup...", "info");
  await ensureAudioReactiveVisualizer();
  if (hasLiveAudioSpectrum()) {
    setActionInlineStatus(
      "Live sound pickup enabled (fallback mode).",
      "success"
    );
  }
}

function handleConnectSpotifyClick() {
  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
    logStatus(`${providerName} connect is coming soon. Switch to Spotify for now.`);
    setActionInlineStatus(`${providerName} connect is not available yet.`, "error");
    return;
  }

  setActionInlineStatus("Opening Spotify authorization...", "info");
  window.location.assign("/auth/spotify/login");
}

function handleConnectProviderClick(providerValue) {
  if (elements.provider.value !== providerValue) {
    elements.provider.value = providerValue;
    invalidatePlaybackStateCache();
    updateProviderUi();
    saveInputsToLocalStorage();
  }
  handleConnectSpotifyClick();
}

function handleUseLocationClick() {
  if (!("geolocation" in navigator)) {
    elements.locationStatus.textContent = "Location isn't available in this browser.";
    return;
  }
  elements.locationStatus.textContent = "Requesting location permission...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        lat: Math.round(position.coords.latitude * 100) / 100,
        lon: Math.round(position.coords.longitude * 100) / 100
      };
      localStorage.setItem(USE_LOCATION_ENABLED_KEY, "true");
      localStorage.setItem(USE_LOCATION_COORDS_KEY, JSON.stringify(coords));
      elements.locationStatus.textContent =
        "Location saved locally. Your Spotify profile region already drives regional tuning.";
      logStatus("Location access granted and saved locally.");
    },
    (error) => {
      elements.locationStatus.textContent = `Location request failed: ${error.message}`;
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

function updateLocationStatusFromStorage() {
  const enabled = localStorage.getItem(USE_LOCATION_ENABLED_KEY) === "true";
  elements.locationStatus.textContent = enabled
    ? "On — location saved locally on this device."
    : "Off — region comes from your Spotify profile.";
}

async function handleDjRemixModeChange() {
  saveInputsToLocalStorage();
  await syncDjSessionMode();
  updateDjAutopilotStatus();
}

function handleDjAutopilotToggle() {
  saveInputsToLocalStorage();
  if (elements.djAutopilotEnabled.checked) {
    startDjAutopilotLoop();
    setActionInlineStatus("DJ Autopilot enabled.", "info");
  } else {
    stopDjAutopilotLoop();
    lastAutoplayTriggerTrackUri = null;
    setActionInlineStatus("DJ Autopilot disabled.", "info");
  }
  updateDjAutopilotStatus();
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
    clearRecommendationUi("Connect Spotify first, then generate a vibe.");
    setRecommendationInlineStatus("Connect Spotify first.", "error");
    return;
  }

  recommendationInFlight = true;
  showLoadingSpinner("Generating vibe...");
  updateRecommendationButtons();
  setRecommendationInlineStatus("Reading your queue and mood…", "info");
  elements.recommendationStatus.textContent = "Tuning into your session…";

  try {
    await refreshSpotifyProfileContext({ silent: true });
    const plan = await apiRequest(
      "/auth/spotify/dj/recommend/next",
      "POST",
      accessToken,
      {
        sessionId: getOrCreateDjSessionId(),
        userContext: buildUserContext()
      }
    );
    renderRecommendationPlan(plan);
    setRecommendationInlineStatus("Next vibe ready.", "success");
    for (const line of plan?.logicLog ?? []) {
      logStatus(`Logic Log: ${line}`);
    }
    logStatus(
      `Recommendation generated: ${plan?.selectedCandidate?.name ?? "unknown track"}`
    );
    await refreshNowPlaying({ silent: true });
  } catch (error) {
    clearRecommendationUi(`Recommendation failed: ${error.message}`);
    setRecommendationInlineStatus(`Recommendation failed: ${error.message}`, "error");
    logStatus(`Recommendation failed: ${error.message}`);
  } finally {
    hideLoadingSpinner();
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
    setActionInlineStatus("Queueing top recommendation...", "info");
    const plan = latestRecommendationPlan;
    if (!plan?.selectedCandidate?.uri) {
      throw new Error("Generate a vibe first.");
    }

    const bpmMatchPercent = computeBpmMatchPercent(
      plan?.currentTrack?.tempo,
      plan?.selectedCandidate?.tempo
    );

    applyRecommendationToInputs();
    if (bpmMatchPercent !== null && bpmMatchPercent > 90) {
      await armFlowInjectionForPlan(plan, bpmMatchPercent);
      return;
    }

    setFlowInjectionIndicator("");
    await handleQueueAction({
      forceQueueOnly: false,
      trackUriOverride: plan.selectedCandidate.uri
    });
    setActionInlineStatus("Top recommendation queued.", "success");
  } catch (error) {
    logStatus(`Could not queue recommendation: ${error.message}`);
    setActionInlineStatus(`Could not queue recommendation: ${error.message}`, "error");
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
      throw new Error("Generate a vibe first.");
    }

    setActionButtonsDisabled(true);
    recommendationInFlight = true;
  showLoadingSpinner("Generating vibe...");
  updateRecommendationButtons();
    setActionInlineStatus("Queueing top recommendations...", "info");

    for (const item of queuePlan) {
      const topQueueResult = await apiRequest("/auth/spotify/player/queue", "POST", accessToken, {
        trackUri: item.uri,
        deviceId: deviceId || undefined
      });
      persistResolvedSpotifyDevice(topQueueResult);
    }

    const queueNames = queuePlan.map((item) => item.name).join(", ");
    logStatus(`Queued top ${queuePlan.length} recommendations: ${queueNames}.`);
    setActionInlineStatus(`Queued top ${queuePlan.length} recommendations.`, "success");
    elements.recommendationStatus.textContent =
      `Queued top ${queuePlan.length} scored tracks in order.`;
  } catch (error) {
    logStatus(`Could not queue top recommendations: ${error.message}`);
    setActionInlineStatus(`Could not queue top recommendations: ${error.message}`, "error");
  } finally {
    hideLoadingSpinner();
    recommendationInFlight = false;
    setActionButtonsDisabled(false);
    updateRecommendationButtons();
  }
}

function updateSmartQueueButtons() {
  const providerSupported = isProviderSupported(getSelectedProvider());
  elements.queueSmartQueueButton.disabled = !providerSupported || smartQueueInFlight;
}

async function handleQueueSmartFlowClick() {
  const provider = getSelectedProvider();
  if (!isProviderSupported(provider)) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;
    setInlineStatus(
      elements.smartQueueInlineStatus,
      `${providerName} support is coming soon. Switch provider to Spotify for now.`,
      "error"
    );
    return;
  }

  const accessToken = elements.accessToken.value.trim();
  if (!accessToken) {
    setInlineStatus(elements.smartQueueInlineStatus, "Connect Spotify first.", "error");
    return;
  }

  const deviceId = elements.deviceId.value.trim();

  smartQueueInFlight = true;
  updateSmartQueueButtons();
  setInlineStatus(elements.smartQueueInlineStatus, "Planning the flow…", "info");
  elements.smartQueueStatus.textContent = "Ordering upcoming tracks for smooth transitions…";

  try {
    const plan = await apiRequest("/auth/spotify/dj/smart-queue", "POST", accessToken, {
      sessionId: getOrCreateDjSessionId(),
      userContext: buildUserContext(),
      queueLength: 5
    });

    const queue = plan?.queue ?? [];
    if (queue.length === 0) {
      throw new Error("Could not build a smart queue from the current candidates.");
    }

    setInlineStatus(elements.smartQueueInlineStatus, `Queueing ${queue.length} tracks…`, "info");

    for (const item of queue) {
      if (!item.track?.uri) {
        continue;
      }
      const queueResult = await apiRequest("/auth/spotify/player/queue", "POST", accessToken, {
        trackUri: item.track.uri,
        deviceId: deviceId || undefined
      });
      persistResolvedSpotifyDevice(queueResult);
    }

    elements.smartQueueStatus.textContent = `Queued ${queue.length} tracks ordered for BPM, key, and energy flow.`;
    setInlineStatus(elements.smartQueueInlineStatus, `Queued ${queue.length} tracks in flow order.`, "success");
    logStatus(`Queued smart queue: ${queue.length} tracks in flow order.`);
  } catch (error) {
    elements.smartQueueStatus.textContent = `Smart queue failed: ${error.message}`;
    setInlineStatus(elements.smartQueueInlineStatus, `Smart queue failed: ${error.message}`, "error");
    logStatus(`Smart queue failed: ${error.message}`);
  } finally {
    smartQueueInFlight = false;
    updateSmartQueueButtons();
  }
}

function bindEvents() {
  for (const tab of document.querySelectorAll(".app-nav-tab")) {
    tab.addEventListener("click", () => setActiveAppView(tab.dataset.view));
  }
  elements.provider.addEventListener("change", () => {
    invalidatePlaybackStateCache();
    updateProviderUi();
    saveInputsToLocalStorage();
  });
  elements.quickPreviousButton.addEventListener("click", handleQuickPreviousClick);
  elements.quickPauseResumeButton.addEventListener(
    "click",
    handleQuickPauseResumeClick
  );
  elements.quickNextButton.addEventListener("click", handleQuickNextClick);
  elements.connectSpotifyButton.addEventListener("click", () =>
    handleConnectProviderClick("spotify")
  );
  elements.connectSoundcloudButton.addEventListener("click", () =>
    handleConnectProviderClick("soundcloud")
  );
  elements.connectAppleMusicButton.addEventListener("click", () =>
    handleConnectProviderClick("apple_music")
  );
  elements.connectYoutubeMusicButton.addEventListener("click", () =>
    handleConnectProviderClick("youtube_music")
  );
  elements.connectTidalButton.addEventListener("click", () =>
    handleConnectProviderClick("tidal")
  );
  elements.useLocationButton.addEventListener("click", handleUseLocationClick);
  elements.listenerAge.addEventListener("change", () => {
    saveInputsToLocalStorage();
    savePersonalizationData();
  });
  elements.listenerGender.addEventListener("change", () => {
    saveInputsToLocalStorage();
    savePersonalizationData();
  });
  elements.nowPlayingVisualizer.addEventListener("click", handleEnableLiveSpectrumClick);
  elements.nowPlayingHeroBg.addEventListener("click", handleEnableLiveSpectrumClick);
  elements.nowPlayingHeroAlbumArt.addEventListener("click", handleEnableLiveSpectrumClick);
  elements.quickPlayNowButton.addEventListener("click", handlePlayNowClick);
  elements.queueFromUriButton.addEventListener("click", handleQueueFromUriClick);
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
  elements.queueSmartQueueButton.addEventListener(
    "click",
    handleQueueSmartFlowClick
  );
  elements.searchTracksButton.addEventListener("click", () =>
    searchTracks({ source: "manual" })
  );
  elements.contextMoodLevel.addEventListener("input", () => {
    updateEnvironmentContextBar();
    saveInputsToLocalStorage();
  });
  elements.contextNostalgiaSlider?.addEventListener("input", () => {
    updateEnvironmentContextBar();
    saveInputsToLocalStorage();
  });
  elements.environmentContextBadges?.addEventListener("click", (event) => {
    const badge = event.target.closest("[data-temp-display-cycle]");
    if (!badge) {
      return;
    }
    event.preventDefault();
    cycleOutdoorTempDisplayUnit();
  });
  elements.environmentContextBadges?.addEventListener("keydown", (event) => {
    const badge = event.target.closest("[data-temp-display-cycle]");
    if (!badge) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cycleOutdoorTempDisplayUnit();
    }
  });
  elements.lyricOffsetMs?.addEventListener("input", () => {
    saveInputsToLocalStorage();
    if (nowPlayingTickerState) {
      const d = Number(nowPlayingTickerState.durationMs) || 1;
      const elapsed = nowPlayingTickerState.isPlaying
        ? Date.now() - nowPlayingTickerState.renderedAtMs
        : 0;
      const p = Math.max(
        0,
        Math.min(d, Number(nowPlayingTickerState.baseProgressMs) + elapsed)
      );
      applyLyricCaptionForProgress(
        p,
        d,
        Boolean(nowPlayingTickerState.isPlaying),
        Math.max(0, d - p)
      );
    }
  });
  elements.accessToken.addEventListener("change", () => {
    saveInputsToLocalStorage();
    invalidatePlaybackStateCache();
    refreshNowPlaying({ silent: true });
    refreshSpotifyProfileContext({ silent: true });
  });
  elements.refreshToken.addEventListener("change", saveInputsToLocalStorage);
  elements.djRemixMode.addEventListener("change", handleDjRemixModeChange);
  elements.djAutopilotEnabled.addEventListener("change", handleDjAutopilotToggle);
  elements.trackUri.addEventListener("input", () => {
    tryAutoSelectProviderFromText(elements.trackUri.value);
  });
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
  getOrCreateDjSessionId();
  setActiveAppView(getActiveAppView());
  ensureHeroVisualizerBars();
  loadInputsFromLocalStorage();
  applyTokensFromUrlIfPresent();
  updateEnvironmentContextBar();
  setAdvancedSettingsVisible(isAdvancedSettingsVisible());
  updateProviderUi();
  updateAutoSeekUi();
  updateDjAutopilotStatus();
  clearRecommendationUi("Generate a vibe to see your next best track.");
  renderNowPlayingEmpty();
  clearSearchResults("Search for a song or paste a Spotify link.");
  setSearchInlineStatus("");
  setRecommendationInlineStatus("");
  setActionInlineStatus("");
  bindEvents();
  enhanceFormInputs();
  syncDjSessionMode();
  maybeResumePendingQueueWatcher();
  refreshNowPlaying({ silent: true });
  refreshSpotifyProfileContext({ silent: true });
  loadPersonalizationData({ silent: true });
  void refreshLiveEnvironmentSignals();
  setInterval(() => void refreshLiveEnvironmentSignals(), ENV_SIGNALS_CACHE_TTL_MS);
  startNowPlayingPolling();
  if (elements.djAutopilotEnabled.checked) {
    startDjAutopilotLoop();
  }
}

init();

// ============ DRAG-TO-SEEK, LYRICS PAUSE, AND PROGRESS HOVER BUBBLE ============

// Track lyrics animation playback state
let lyricsAnimationElement = null;

// Intercept applyLyricMarqueeAnimation to add pause control
const originalApplyLyricMarqueeAnimation = window.applyLyricMarqueeAnimation || function(){};
window.applyLyricMarqueeAnimation = function(el, text, isPlaying) {
  lyricsAnimationElement = el;
  const durationSec = Math.max(6, Math.min(26, (text?.length || 0) * 0.115)) + 2;
  el.style.animation = 'none';
  void el.offsetWidth; // Force reflow
  el.style.animation = `heroLyricsMarquee ${durationSec.toFixed(2)}s linear infinite`;
  el.style.animationPlayState = isPlaying ? 'running' : 'paused';
};

// Listen for playback state changes to pause/resume lyrics
const observer = new MutationObserver(() => {
  const isPlayingNow = nowPlayingTickerState?.isPlaying;
  if (lyricsAnimationElement && isPlayingNow !== undefined) {
    lyricsAnimationElement.style.animationPlayState = isPlayingNow ? 'running' : 'paused';
  }
});

observer.observe(document.body, { subtree: true, attributes: true });

// Drag-to-seek with hover bubble
(function initProgressBarWithHover() {
  const progressShell = document.querySelector('.progress-shell');
  if (!progressShell) return;
  
  let isDragging = false;
  let hoverBubble = null;
  
  function createHoverBubble() {
    if (!hoverBubble) {
      hoverBubble = document.createElement('div');
      hoverBubble.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 0;
        transform: translateX(-50%);
        background: rgba(0, 209, 255, 0.95);
        color: #ffffff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        z-index: 100;
        font-family: ui-monospace, monospace;
        margin-bottom: 8px;
      `;
      progressShell.parentElement.style.position = 'relative';
      progressShell.parentElement.appendChild(hoverBubble);
    }
    return hoverBubble;
  }
  
  function updateBubble(e) {
    const rect = progressShell.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    const timeText = elements.nowPlayingProgressText?.textContent || '';
    const [_, durationStr] = timeText.split(' / ');
    if (!durationStr) return;
    
    const durationMs = parseTimeToMs(durationStr);
    const seekMs = Math.round(durationMs * percentage);
    const bubbleEl = createHoverBubble();
    bubbleEl.textContent = formatMs(seekMs);
    bubbleEl.style.left = `${clickX}px`;
    bubbleEl.style.display = 'block';
  }
  
  function hideBubble() {
    if (hoverBubble) {
      hoverBubble.style.display = 'none';
    }
  }
  
  progressShell.addEventListener('mousemove', updateBubble);
  progressShell.addEventListener('mouseleave', hideBubble);
  
  progressShell.addEventListener('mousedown', (e) => {
    isDragging = true;
    seekToClick(e);
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    seekToClick(e);
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    hideBubble();
  });
  
  function seekToClick(e) {
    const rect = progressShell.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    const timeText = elements.nowPlayingProgressText?.textContent || '';
    const [_, durationStr] = timeText.split(' / ');
    if (!durationStr) return;
    
    const durationMs = parseTimeToMs(durationStr);
    const seekMs = Math.round(durationMs * percentage);
    
    elements.nowPlayingProgressBar.style.width = `${(percentage * 100).toFixed(1)}%`;
    elements.nowPlayingProgressText.textContent = `${formatMs(seekMs)} / ${durationStr}`;
    
    if (spotifyPlayer && typeof spotifyPlayer.seek === 'function') {
      spotifyPlayer.seek(seekMs);
    }
  }
  
  function parseTimeToMs(timeStr) {
    const parts = timeStr.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2) {
      return (parts[0] * 60 + parts[1]) * 1000;
    } else if (parts.length === 3) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    return 0;
  }
})();


// ============ SEARCH DEBOUNCE & OPTIMIZATIONS ============
let searchTimeout = null;
const originalSearchTracks = window.searchTracks;

window.searchTracks = function(query) {
  clearTimeout(searchTimeout);
  if (!query || query.length < 1) {
    elements.searchResults.innerHTML = '<div class="result-empty">Type to search</div>';
    return;
  }
  
  // Show loading state
  elements.searchResults.innerHTML = '<div class="result-empty">Searching...</div>';
  
  searchTimeout = setTimeout(() => {
    originalSearchTracks(query);
  }, 300); // Debounce API call by 300ms
};

// Cache audio analysis to avoid re-fetching
const audioAnalysisCache = new Map();

// Add connection retry logic
let retryCount = 0;
const maxRetries = 3;


// ============ BETTER ERROR HANDLING & STATES ============
function showLoadingState(element, message = 'Loading...') {
  if (element) {
    element.innerHTML = `<div style="text-align:center;opacity:0.6;padding:20px;">${message}</div>`;
  }
}

function showErrorState(element, message = 'Something went wrong') {
  if (element) {
    element.innerHTML = `<div style="color:#ff6b6b;text-align:center;padding:20px;">${message}</div>`;
  }
}

// Add retry logic to API calls
async function callWithRetry(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}


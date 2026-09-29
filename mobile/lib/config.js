export const DEFAULT_API_BASE_URL = "https://corners-trustees-singer-officers.trycloudflare.com";

export const NOW_PLAYING_POLL_ACTIVE_MS = 1000;
export const NOW_PLAYING_POLL_IDLE_MS = 1800;
export const NOW_PLAYING_TICKER_MS = 250;

export const QUEUE_POLL_INTERVAL_MS = 2000;
export const QUEUE_POLL_MAX_ATTEMPTS = 75;
export const SEEK_VERIFY_WAITS_MS = [800, 1300, 1900];
export const SEEK_MAX_DRIFT_MS = 5500;

export const AUTOPILOT_TICK_MS = 1500;
export const AUTOPILOT_TRIGGER_WINDOW_MS = { start: 20000, end: 15000 };
export const FLOW_INJECTION_POLL_MS = 900;
export const EARLY_SKIP_THRESHOLD_MS = 30000;

export const LYRIC_LINE_FADE_IN_MS = 520;
export const LYRIC_LINE_FADE_OUT_MS = 420;
export const LYRICS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export const SONG_SPECTRUM_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
export const SONG_SPECTRUM_CACHE_MAX = 140;
export const VISUALIZER_BAR_COUNT = 30;
export const VISUALIZER_ATTACK_RATE = 0.36;
export const VISUALIZER_DECAY_RATE = 0.2;

export const ENV_SIGNALS_CACHE_TTL_MS = 1000 * 60 * 20;

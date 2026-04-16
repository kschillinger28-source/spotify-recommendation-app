/**
 * Music provider strategy — central switch for multi-platform support.
 * Spotify is fully wired; Apple Music & SoundCloud are prepared for integration.
 */

export const PROVIDER = {
  SPOTIFY: "spotify",
  APPLE_MUSIC: "apple_music",
  SOUNDCLOUD: "soundcloud"
};

/**
 * @returns {"spotify"|"apple_music"|"soundcloud"|null}
 */
export function detectProviderFromUrl(text) {
  const raw = String(text ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!raw) {
    return null;
  }

  if (/^spotify:/i.test(raw)) {
    return PROVIDER.SPOTIFY;
  }

  const tryHost = (href) => {
    try {
      const u = new URL(href);
      const h = u.hostname.toLowerCase();
      if (h === "soundcloud.com" || h.endsWith(".soundcloud.com")) {
        return PROVIDER.SOUNDCLOUD;
      }
      if (
        h === "music.apple.com" ||
        h.endsWith("music.apple.com") ||
        h.endsWith("itunes.apple.com") ||
        (h.endsWith("apple.com") && /\/(album|playlist|song|music)/i.test(u.pathname))
      ) {
        return PROVIDER.APPLE_MUSIC;
      }
      if (h === "open.spotify.com" || h.endsWith(".spotify.com")) {
        return PROVIDER.SPOTIFY;
      }
    } catch {
      return null;
    }
    return null;
  };

  let detected = tryHost(raw);
  if (!detected && !/^https?:\/\//i.test(raw)) {
    detected = tryHost(`https://${raw}`);
  }
  return detected;
}

/**
 * Strategy metadata for UI and routing (extend as backends are added).
 */
export function getProviderStrategy(provider) {
  switch (provider) {
    case PROVIDER.SPOTIFY:
      return {
        id: PROVIDER.SPOTIFY,
        label: "Spotify",
        playbackReady: true,
        searchReady: true
      };
    case PROVIDER.APPLE_MUSIC:
      return {
        id: PROVIDER.APPLE_MUSIC,
        label: "Apple Music",
        playbackReady: false,
        searchReady: false
      };
    case PROVIDER.SOUNDCLOUD:
      return {
        id: PROVIDER.SOUNDCLOUD,
        label: "SoundCloud",
        playbackReady: false,
        searchReady: false
      };
    default:
      return {
        id: String(provider ?? ""),
        label: String(provider ?? "Unknown"),
        playbackReady: false,
        searchReady: false
      };
  }
}

export function resolvePlaybackRoute(provider, action) {
  switch (provider) {
    case PROVIDER.SPOTIFY:
      return { delegate: "spotifyWebApi", action };
    case PROVIDER.APPLE_MUSIC:
      return { delegate: "appleMusic", action, pending: true };
    case PROVIDER.SOUNDCLOUD:
      return { delegate: "soundcloud", action, pending: true };
    default:
      return { delegate: "unknown", action, pending: true };
  }
}

export async function playAppleMusic() {
  /* Wire to MusicKit / Apple APIs when ready */
}

export async function playSoundCloud() {
  /* Wire to SoundCloud playback when ready */
}

export async function queueAppleMusic() {
  /* Wire to Apple Music queue when ready */
}

export async function queueSoundCloud() {
  /* Wire to SoundCloud queue when ready */
}

/**
 * Transport abstraction so vibe / DJ logic can target Spotify today and
 * Apple Music / SoundCloud later without rewriting callers.
 */
export class UniversalPlayer {
  /**
   * @param {"spotify" | "apple_music" | "soundcloud"} provider
   * @param {(method: string, path: string, body?: object) => Promise<any>} apiRequest
   */
  constructor(provider, apiRequest) {
    this.provider = provider;
    this.apiRequest = apiRequest;
  }

  async setVolume(accessToken, volumePercent, deviceId) {
    if (this.provider !== "spotify") {
      throw new Error(`${this.provider} transport not implemented yet.`);
    }
    await this.apiRequest("/auth/spotify/player/volume", "PUT", accessToken, {
      volumePercent,
      deviceId: deviceId || undefined
    });
  }

  async seek(accessToken, positionMs, deviceId) {
    if (this.provider !== "spotify") {
      throw new Error(`${this.provider} transport not implemented yet.`);
    }
    await this.apiRequest("/auth/spotify/player/seek", "PUT", accessToken, {
      positionMs,
      deviceId: deviceId || undefined
    });
  }

  async play(accessToken, { trackUri, deviceId, positionMs = 0 } = {}) {
    if (this.provider !== "spotify") {
      throw new Error(`${this.provider} transport not implemented yet.`);
    }
    await this.apiRequest("/auth/spotify/player/play-now", "PUT", accessToken, {
      trackUri,
      deviceId: deviceId || undefined,
      positionMs
    });
  }
}

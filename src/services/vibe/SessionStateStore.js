function nowIso() {
  return new Date().toISOString();
}

function toBucketKey(tempo) {
  const value = Number(tempo);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const start = Math.floor(value / 10) * 10;
  return `${start}-${start + 9}`;
}

const SESSION_MAX_IDLE_MS = 1000 * 60 * 60 * 8;
const SESSION_MAX_COUNT = 300;

export default class SessionStateStore {
  constructor() {
    this.sessions = new Map();
  }

  pruneSessions(nowMs = Date.now()) {
    for (const [sessionId, session] of this.sessions.entries()) {
      const updatedAtMs = Date.parse(String(session?.updatedAt ?? ""));
      if (!Number.isFinite(updatedAtMs)) {
        continue;
      }
      if (nowMs - updatedAtMs > SESSION_MAX_IDLE_MS) {
        this.sessions.delete(sessionId);
      }
    }

    if (this.sessions.size <= SESSION_MAX_COUNT) {
      return;
    }

    const ordered = [...this.sessions.values()]
      .map((session) => ({
        sessionId: session.sessionId,
        updatedAtMs: Date.parse(String(session.updatedAt ?? ""))
      }))
      .sort((a, b) => (a.updatedAtMs || 0) - (b.updatedAtMs || 0));
    const overflow = this.sessions.size - SESSION_MAX_COUNT;
    for (const entry of ordered.slice(0, overflow)) {
      this.sessions.delete(entry.sessionId);
    }
  }

  ensureSession(sessionId) {
    const safeId = String(sessionId || "").trim();
    if (!safeId) {
      throw new Error("sessionId is required.");
    }

    this.pruneSessions();

    if (!this.sessions.has(safeId)) {
      this.sessions.set(safeId, {
        sessionId: safeId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        remixModeEnabled: false,
        artistPenalty: {},
        genrePenalty: {},
        bpmRangePenalty: {},
        skippedTrackPenalty: {},
        recommendedTrackCount: {},
        recommendedArtistCount: {},
        searchAffinity: {
          latestQuery: "",
          termWeights: {},
          artistTermWeights: {}
        }
      });
    }

    return this.sessions.get(safeId);
  }

  touch(session) {
    session.updatedAt = nowIso();
  }

  setRemixMode(sessionId, enabled) {
    const session = this.ensureSession(sessionId);
    session.remixModeEnabled = Boolean(enabled);
    this.touch(session);
    return this.snapshot(sessionId);
  }

  recordRecommendedTrack(sessionId, recommendation) {
    const session = this.ensureSession(sessionId);
    const trackId = String(recommendation?.trackId ?? "").trim();
    const artistIds = Array.isArray(recommendation?.artistIds)
      ? recommendation.artistIds.filter(Boolean)
      : [];

    if (trackId) {
      session.recommendedTrackCount[trackId] =
        (session.recommendedTrackCount[trackId] ?? 0) + 1;
    }

    for (const artistId of artistIds) {
      session.recommendedArtistCount[artistId] =
        (session.recommendedArtistCount[artistId] ?? 0) + 1;
    }

    this.touch(session);
    return this.snapshot(sessionId);
  }

  recordSearchAffinity(sessionId, queryText) {
    const session = this.ensureSession(sessionId);
    const query = String(queryText ?? "")
      .toLowerCase()
      .trim();
    if (!query) {
      return this.snapshot(sessionId);
    }

    session.searchAffinity.latestQuery = query;
    const terms = query
      .split(/[^a-z0-9]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3)
      .slice(0, 8);

    for (const term of terms) {
      session.searchAffinity.termWeights[term] =
        (session.searchAffinity.termWeights[term] ?? 0) + 1.5;
      // Track multi-word or artist-like terms separately for stronger boosts.
      if (!["song", "music", "mix", "vibe", "mood"].includes(term)) {
        session.searchAffinity.artistTermWeights[term] =
          (session.searchAffinity.artistTermWeights[term] ?? 0) + 2;
      }
    }

    this.touch(session);
    return this.snapshot(sessionId);
  }

  recordSkipFeedback(sessionId, feedback) {
    const session = this.ensureSession(sessionId);
    const progressMs = Number(feedback?.progressMs ?? 0);
    if (!Number.isFinite(progressMs) || progressMs > 30000) {
      return this.snapshot(sessionId);
    }

    const artistIds = Array.isArray(feedback?.artistIds) ? feedback.artistIds : [];
    const genres = Array.isArray(feedback?.genreTags) ? feedback.genreTags : [];
    const trackId = String(feedback?.trackId ?? "").trim();
    const bpmBucket = toBucketKey(feedback?.tempo);

    if (trackId) {
      session.skippedTrackPenalty[trackId] =
        (session.skippedTrackPenalty[trackId] ?? 0) + 10;
    }

    for (const artistId of artistIds.filter(Boolean)) {
      session.artistPenalty[artistId] = (session.artistPenalty[artistId] ?? 0) + 7;
    }

    for (const genre of genres.map((genre) => String(genre).toLowerCase().trim()).filter(Boolean)) {
      session.genrePenalty[genre] = (session.genrePenalty[genre] ?? 0) + 5;
    }

    if (bpmBucket) {
      session.bpmRangePenalty[bpmBucket] =
        (session.bpmRangePenalty[bpmBucket] ?? 0) + 4.5;
    }

    this.touch(session);
    return this.snapshot(sessionId);
  }

  snapshot(sessionId) {
    const session = this.ensureSession(sessionId);
    return JSON.parse(JSON.stringify(session));
  }
}

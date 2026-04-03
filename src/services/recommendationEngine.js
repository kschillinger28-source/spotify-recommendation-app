import {
  getAudioFeaturesByTrackIds,
  getCurrentPlayback,
  getPlaybackQueue,
  getSpotifyRecommendations,
  getUserTopTracks
} from "../utils/spotify.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function mapCurrentTrack(track) {
  if (!track) {
    return null;
  }

  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artistNames: (track.artists ?? []).map((artist) => artist.name),
    artists: (track.artists ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name
    })),
    albumName: track.album?.name ?? "",
    albumImageUrl:
      track.album?.images?.[0]?.url ??
      track.album?.images?.[1]?.url ??
      null,
    durationMs: track.duration_ms ?? 0,
    explicit: Boolean(track.explicit),
    popularity: Number.isFinite(track.popularity) ? track.popularity : 0
  };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const output = [];

  for (const candidate of candidates) {
    if (!candidate?.uri || seen.has(candidate.uri)) {
      continue;
    }
    seen.add(candidate.uri);
    output.push(candidate);
  }

  return output;
}

function sourceBonus(source) {
  if (source === "recommendation") {
    return 12;
  }
  if (source === "queue") {
    return 8;
  }
  if (source === "top_track") {
    return 6;
  }
  return 4;
}

function computeTempoDistanceBpm(aTempo, bTempo) {
  if (!Number.isFinite(aTempo) || !Number.isFinite(bTempo) || aTempo <= 0 || bTempo <= 0) {
    return null;
  }

  const direct = Math.abs(aTempo - bTempo);
  const halfDoubleA = Math.abs(aTempo * 2 - bTempo);
  const halfDoubleB = Math.abs(aTempo - bTempo * 2);
  return Math.min(direct, halfDoubleA, halfDoubleB);
}

function scoreNextSongCandidate(candidate, context) {
  const currentTrack = context.currentTrack;
  const primaryCandidateArtistId = candidate.artists?.[0]?.id ?? null;
  const currentPrimaryArtistId = currentTrack.artists?.[0]?.id ?? null;
  const currentPopularity = Number(currentTrack.popularity ?? 50);
  const candidatePopularity = Number(candidate.popularity ?? 50);

  const artistContinuity =
    primaryCandidateArtistId &&
    currentPrimaryArtistId &&
    primaryCandidateArtistId === currentPrimaryArtistId
      ? 18
      : 0;
  const popularityFit = Math.max(
    0,
    18 - Math.abs(candidatePopularity - currentPopularity) * 0.3
  );
  const durationGapSeconds = Math.abs(candidate.durationMs - currentTrack.durationMs) / 1000;
  const durationFit = Math.max(0, 16 - durationGapSeconds * 0.2);
  const tempoDistance = computeTempoDistanceBpm(currentTrack.tempo, candidate.tempo);
  const bpmFit =
    tempoDistance === null ? 3 : Math.max(0, 14 - Math.min(28, tempoDistance) * 0.5);
  const energyGap = Number.isFinite(currentTrack.energy) && Number.isFinite(candidate.energy)
    ? Math.abs(currentTrack.energy - candidate.energy)
    : null;
  const energyFit = energyGap === null ? 2 : Math.max(0, 8 - energyGap * 16);
  const explicitFit = candidate.explicit === currentTrack.explicit ? 6 : -2;
  const sourceFit = sourceBonus(candidate.source);
  const repeatPenalty = context.recentUris.has(candidate.uri) ? -20 : 0;

  const total = clamp(
    round1(
      35 +
        artistContinuity +
        popularityFit +
        durationFit +
        bpmFit +
        energyFit +
        explicitFit +
        sourceFit +
        repeatPenalty
    ),
    0,
    100
  );

  const reasons = [];
  if (artistContinuity > 0) {
    reasons.push("same lead artist as current song");
  }
  if (popularityFit >= 10) {
    reasons.push("similar listener popularity profile");
  }
  if (durationFit >= 10) {
    reasons.push("similar track length keeps pacing stable");
  }
  if (bpmFit >= 8) {
    reasons.push("BPM is close to current track for smoother handoff");
  }
  if (energyFit >= 5) {
    reasons.push("energy level is compatible with current groove");
  }
  if (sourceFit >= 10) {
    reasons.push("high-confidence Spotify recommendation source");
  }
  if (repeatPenalty < 0) {
    reasons.push("penalized because this track appears in recent context");
  }

  return {
    score: total,
    scoreBreakdown: {
      artistContinuity: round1(artistContinuity),
      popularityFit: round1(popularityFit),
      durationFit: round1(durationFit),
      bpmFit: round1(bpmFit),
      energyFit: round1(energyFit),
      explicitFit: round1(explicitFit),
      sourceFit: round1(sourceFit),
      repeatPenalty: round1(repeatPenalty)
    },
    reasons
  };
}

function scoreEntryPoint({ candidate, currentRemainingMs }) {
  let offsetMs = 12000;

  if (candidate.durationMs < 180000) {
    offsetMs = 8000;
  } else if (candidate.durationMs > 300000) {
    offsetMs = 17000;
  }

  if (currentRemainingMs <= 15000) {
    offsetMs += 4000;
  } else if (currentRemainingMs >= 90000) {
    offsetMs -= 2500;
  }

  if ((candidate.popularity ?? 0) >= 75) {
    offsetMs += 2000;
  }

  const capByDuration = Math.max(0, Math.min(45000, Math.round(candidate.durationMs * 0.35)));
  let clampedOffsetMs = clamp(Math.round(offsetMs), 0, capByDuration || 45000);
  const candidateTempo = Number(candidate.tempo);
  if (Number.isFinite(candidateTempo) && candidateTempo >= 60 && candidateTempo <= 220) {
    const beatMs = 60000 / candidateTempo;
    const barMs = beatMs * 4;
    clampedOffsetMs = Math.max(0, Math.round(clampedOffsetMs / barMs) * barMs);
    clampedOffsetMs = clamp(clampedOffsetMs, 0, capByDuration || 45000);
  }

  const reasons = [];
  if (candidate.durationMs < 180000) {
    reasons.push("short track: lighter intro skip");
  } else if (candidate.durationMs > 300000) {
    reasons.push("longer track: deeper intro skip");
  } else {
    reasons.push("medium track: balanced intro skip");
  }
  if (currentRemainingMs <= 15000) {
    reasons.push("current song is almost done, favor faster hook-in");
  }
  if ((candidate.popularity ?? 0) >= 75) {
    reasons.push("high-popularity candidate, slight hook-forward bias");
  }
  if (Number.isFinite(candidateTempo) && candidateTempo >= 60 && candidateTempo <= 220) {
    reasons.push("offset quantized to beat-bar boundary for cleaner drop-in");
  }

  return {
    recommendedOffsetMs: clampedOffsetMs,
    recommendedOffsetSeconds: Math.round(clampedOffsetMs / 1000),
    reasons
  };
}

function buildTransitionPlan({ currentRemainingMs, entryPoint }) {
  let recommendedSeekDelayMs = 1200;
  let strategy = "Queue now and allow a smooth handoff before seeking.";

  if (currentRemainingMs <= 15000) {
    recommendedSeekDelayMs = 0;
    strategy = "Queue now and seek immediately when target starts.";
  } else if (currentRemainingMs <= 45000) {
    recommendedSeekDelayMs = 600;
    strategy = "Queue now and use a short seek delay for continuity.";
  }

  return {
    action: "queue_now_then_auto_seek",
    queueNow: true,
    estimatedSwitchInMs: Math.max(0, currentRemainingMs),
    estimatedSwitchInSeconds: Math.max(0, Math.round(currentRemainingMs / 1000)),
    recommendedSeekDelayMs,
    recommendedSeekDelaySeconds: Math.round(recommendedSeekDelayMs / 1000),
    recommendedOffsetMs: entryPoint.recommendedOffsetMs,
    recommendedOffsetSeconds: entryPoint.recommendedOffsetSeconds,
    strategy
  };
}

export async function buildNextSongRecommendation(accessToken) {
  const playback = await getCurrentPlayback(accessToken);
  if (!playback?.item) {
    throw new Error("No active Spotify track found. Start playback and try again.");
  }

  const currentTrack = mapCurrentTrack(playback.item);
  const currentProgressMs = Math.max(0, Number(playback.progress_ms) || 0);
  const currentRemainingMs = Math.max(0, (currentTrack.durationMs || 0) - currentProgressMs);

  const seedTrackIds = currentTrack.id ? [currentTrack.id] : [];
  const seedArtistIds = currentTrack.artists?.[0]?.id ? [currentTrack.artists[0].id] : [];

  const [recommendationResult, queueResult, topTracksResult] = await Promise.allSettled([
    getSpotifyRecommendations(accessToken, {
      seedTrackIds,
      seedArtistIds,
      limit: 24
    }),
    getPlaybackQueue(accessToken),
    getUserTopTracks(accessToken, { limit: 12, timeRange: "short_term" })
  ]);

  const recommendationCandidates =
    recommendationResult.status === "fulfilled"
      ? recommendationResult.value.map((track) => ({ ...track, source: "recommendation" }))
      : [];
  const queueCandidates =
    queueResult.status === "fulfilled"
      ? queueResult.value.map((track) => ({ ...track, source: "queue" }))
      : [];
  const topTrackCandidates =
    topTracksResult.status === "fulfilled"
      ? topTracksResult.value.map((track) => ({ ...track, source: "top_track" }))
      : [];

  const recentUris = new Set([
    currentTrack.uri,
    ...queueCandidates.slice(0, 10).map((track) => track.uri)
  ]);

  const candidatePool = dedupeCandidates([
    ...recommendationCandidates,
    ...queueCandidates,
    ...topTrackCandidates
  ]).filter((candidate) => candidate.uri && candidate.uri !== currentTrack.uri);

  if (candidatePool.length === 0) {
    throw new Error(
      "Could not generate recommendation candidates from Spotify right now."
    );
  }

  const audioFeatureIds = [
    currentTrack.id,
    ...candidatePool.map((candidate) => candidate.id).filter(Boolean)
  ];
  let audioFeaturesByTrackId = {};
  try {
    audioFeaturesByTrackId = await getAudioFeaturesByTrackIds(accessToken, audioFeatureIds);
  } catch {
    audioFeaturesByTrackId = {};
  }

  const currentFeatures = audioFeaturesByTrackId[currentTrack.id] ?? {};
  currentTrack.tempo = Number.isFinite(currentFeatures.tempo) ? currentFeatures.tempo : null;
  currentTrack.energy = Number.isFinite(currentFeatures.energy) ? currentFeatures.energy : null;

  const enrichedCandidates = candidatePool.map((candidate) => {
    const features = audioFeaturesByTrackId[candidate.id] ?? {};
    return {
      ...candidate,
      tempo: Number.isFinite(features.tempo) ? features.tempo : null,
      energy: Number.isFinite(features.energy) ? features.energy : null
    };
  });

  const scoredCandidates = enrichedCandidates
    .map((candidate) => {
      const scored = scoreNextSongCandidate(candidate, {
        currentTrack,
        recentUris
      });

      return {
        ...candidate,
        ...scored
      };
    })
    .sort((a, b) => b.score - a.score);

  const selectedCandidate = scoredCandidates[0];
  const entryPoint = scoreEntryPoint({
    candidate: selectedCandidate,
    currentRemainingMs
  });
  const transitionPlan = buildTransitionPlan({
    currentRemainingMs,
    entryPoint
  });

  return {
    generatedAt: new Date().toISOString(),
    currentTrack: {
      ...currentTrack,
      progressMs: currentProgressMs,
      remainingMs: currentRemainingMs
    },
    candidateSelection: {
      totalCandidates: candidatePool.length,
      recommendationCandidates: recommendationCandidates.length,
      queueCandidates: queueCandidates.length,
      topTrackCandidates: topTrackCandidates.length
    },
    selectedCandidate,
    topCandidates: scoredCandidates.slice(0, 5),
    entryPoint,
    transitionPlan
  };
}

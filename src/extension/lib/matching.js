import { bigrams, importantTokens, normalizeName, normalizeTitle } from "./text.js";

function logMatch(event, payload) {
  console.debug("[Nebula Match][matching]", event, payload);
}

function diceCoefficient(left, right) {
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);

  if (!leftBigrams.length || !rightBigrams.length) {
    return 0;
  }

  const counts = new Map();

  for (const item of leftBigrams) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let overlap = 0;

  for (const item of rightBigrams) {
    const count = counts.get(item) || 0;

    if (count > 0) {
      counts.set(item, count - 1);
      overlap += 1;
    }
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function jaccardTokens(left, right) {
  const leftTokens = new Set(importantTokens(left));
  const rightTokens = new Set(importantTokens(right));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

export function scoreNameMatch(left, right) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const dice = diceCoefficient(normalizedLeft, normalizedRight);
  const jaccard = jaccardTokens(normalizedLeft, normalizedRight);

  return (dice * 0.65) + (jaccard * 0.35);
}

export function scoreTitleMatch(left, right) {
  const normalizedLeft = normalizeTitle(left);
  const normalizedRight = normalizeTitle(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const dice = diceCoefficient(normalizedLeft, normalizedRight);
  const jaccard = jaccardTokens(normalizedLeft, normalizedRight);
  const containment =
    normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
      ? 1
      : 0;

  return (dice * 0.5) + (jaccard * 0.35) + (containment * 0.15);
}

export function selectBestCreatorMatch(channelName, creators) {
  const scored = creators
    .map((creator) => ({
      creator,
      score: scoreNameMatch(channelName, creator.title)
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const nextBest = scored[1];

  logMatch("creator-candidates", {
    channelName,
    candidates: scored.slice(0, 5).map((item) => ({
      title: item.creator.title,
      slug: item.creator.slug || item.creator.app_path,
      score: Number(item.score.toFixed(4))
    }))
  });

  if (!best || best.score < 0.88) {
    logMatch("creator-rejected", {
      reason: "below-threshold",
      bestScore: best ? Number(best.score.toFixed(4)) : null
    });
    return null;
  }

  if (nextBest && (best.score - nextBest.score) < 0.05) {
    logMatch("creator-rejected", {
      reason: "ambiguous",
      bestScore: Number(best.score.toFixed(4)),
      nextBestScore: Number(nextBest.score.toFixed(4))
    });
    return null;
  }

  logMatch("creator-selected", {
    title: best.creator.title,
    slug: best.creator.slug || best.creator.app_path,
    score: Number(best.score.toFixed(4))
  });

  return {
    ...best.creator,
    score: best.score
  };
}

export function selectBestEpisodeMatch(videoTitle, episodes) {
  const scored = episodes
    .map((episode) => ({
      episode,
      score: scoreTitleMatch(videoTitle, episode.title)
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const nextBest = scored[1];

  logMatch("episode-candidates", {
    videoTitle,
    candidates: scored.slice(0, 5).map((item) => ({
      title: item.episode.title,
      slug: item.episode.channel_slug,
      score: Number(item.score.toFixed(4))
    }))
  });

  if (!best || best.score < 0.75) {
    logMatch("episode-rejected", {
      reason: "below-threshold",
      bestScore: best ? Number(best.score.toFixed(4)) : null
    });
    return null;
  }

  if (nextBest && (best.score - nextBest.score) < 0.06) {
    logMatch("episode-rejected", {
      reason: "ambiguous",
      bestScore: Number(best.score.toFixed(4)),
      nextBestScore: Number(nextBest.score.toFixed(4))
    });
    return null;
  }

  logMatch("episode-selected", {
    title: best.episode.title,
    slug: best.episode.channel_slug,
    score: Number(best.score.toFixed(4))
  });

  return {
    ...best.episode,
    score: best.score
  };
}

export function createNoMatch() {
  return {
    state: "no_match"
  };
}

export function createVideoMatch(creator, episode) {
  return {
    state: "video_match",
    label: "Watch on Nebula",
    targetUrl: episode.shareUrl,
    creator,
    episode
  };
}

export function createCreatorFallback(creator) {
  return {
    state: "creator_fallback",
    label: "View creator on Nebula",
    targetUrl: creator.shareUrl,
    creator
  };
}

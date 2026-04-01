import {
  createCreatorFallback,
  createNoMatch,
  createVideoMatch,
  selectBestCreatorMatch,
  selectBestEpisodeMatch
} from "./matching.js";

const API_BASE_URL = "https://content.api.nebula.app";
const DEFAULT_PAGE_SIZE = 40;
const MAX_EPISODE_PAGES = 3;
const CACHE_TTL_MS = 5 * 60 * 1000;

function debug(event, payload) {
  console.debug("[Nebula Match][client]", event, payload);
}

function createCacheKey(parts) {
  return parts.join("::");
}

function now() {
  return Date.now();
}

async function parseJsonResponse(response) {
  if (!response.ok) {
    throw new Error(`Nebula API request failed with status ${response.status}`);
  }

  return response.json();
}

export class NebulaClient {
  constructor(fetchImpl = (...args) => fetch(...args)) {
    this.fetchImpl = fetchImpl;
    this.cache = new Map();
  }

  async fetchJson(path) {
    debug("fetch-start", { path });
    const response = await this.fetchImpl(`${API_BASE_URL}${path}`, {
      headers: {
        Accept: "application/json"
      }
    });

    debug("fetch-response", {
      path,
      status: response.status,
      ok: response.ok
    });

    return parseJsonResponse(response);
  }

  async getCached(key, factory) {
    const cached = this.cache.get(key);

    if (cached && (now() - cached.createdAt) < CACHE_TTL_MS) {
      debug("cache-hit", { key });
      return cached.value;
    }

    debug("cache-miss", { key });
    const value = await factory();
    this.cache.set(key, { createdAt: now(), value });
    return value;
  }

  async searchCreators(query) {
    const key = createCacheKey(["creators", query]);
    return this.getCached(key, async () => {
      const payload = await this.fetchJson(`/video_channels/search/?q=${encodeURIComponent(query)}`);
      return payload.results || [];
    });
  }

  async getCreator(slug) {
    const key = createCacheKey(["creator", slug]);
    return this.getCached(key, async () => this.fetchJson(`/video_channels/${encodeURIComponent(slug)}/`));
  }

  async listCreatorEpisodes(slug, maxPages = MAX_EPISODE_PAGES, pageSize = DEFAULT_PAGE_SIZE) {
    const key = createCacheKey(["episodes", slug, String(maxPages), String(pageSize)]);
    return this.getCached(key, async () => {
      let nextPath = `/video_channels/${encodeURIComponent(slug)}/video_episodes/?page_size=${pageSize}`;
      const allResults = [];
      let page = 0;

      while (nextPath && page < maxPages) {
        const payload = await this.fetchPage(nextPath);
        allResults.push(...(payload.results || []));
        nextPath = payload.next ? this.absoluteUrlToPath(payload.next) : null;
        page += 1;
      }

      return allResults;
    });
  }

  async searchEpisodes(query) {
    const key = createCacheKey(["searchEpisodes", query]);
    return this.getCached(key, async () => {
      const payload = await this.fetchJson(`/video_episodes/search/?q=${encodeURIComponent(query)}`);
      return payload.results || [];
    });
  }

  async fetchPage(pathOrUrl) {
    const path = this.absoluteUrlToPath(pathOrUrl);
    return this.fetchJson(path);
  }

  absoluteUrlToPath(pathOrUrl) {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      const parsed = new URL(pathOrUrl);
      return `${parsed.pathname}${parsed.search}`;
    }

    return pathOrUrl;
  }

  async resolveMatch(context) {
    debug("resolve-start", context);
    const searchedEpisodes = await this.searchEpisodes(context.title);
    debug("searched-episodes", {
      count: searchedEpisodes.length,
      sample: searchedEpisodes.slice(0, 5).map((episode) => ({
        title: episode.title,
        channelTitle: episode.channel_title,
        channelSlug: episode.channel_slug
      }))
    });
    const searchedCreators = this.extractCreatorsFromEpisodes(searchedEpisodes);
    debug("creators-from-episodes", searchedCreators);
    const creators = this.dedupeCreators([
      ...searchedCreators,
      ...(await this.searchCreators(context.channelName))
    ]);
    debug("creator-pool", creators);
    const selectedCreator = selectBestCreatorMatch(context.channelName, creators);

    if (!selectedCreator) {
      debug("resolve-finish", { state: "no_match", reason: "no-creator" });
      return createNoMatch();
    }

    const creatorModel = await this.resolveCreatorModel(selectedCreator);
    debug("creator-model", creatorModel);
    const creatorScopedSearchedEpisodes = searchedEpisodes.filter(
      (episode) => episode.channel_slug === creatorModel.slug
    );
    debug("creator-scoped-search-results", {
      creatorSlug: creatorModel.slug,
      count: creatorScopedSearchedEpisodes.length
    });
    const bestSearchedEpisode = selectBestEpisodeMatch(context.title, creatorScopedSearchedEpisodes);

    if (bestSearchedEpisode) {
      debug("resolve-finish", {
        state: "video_match",
        source: "episode-search",
        episode: bestSearchedEpisode.title
      });
      return createVideoMatch(creatorModel, this.toEpisodeModel(bestSearchedEpisode));
    }

    const listedEpisodes = await this.listCreatorEpisodes(creatorModel.slug);
    debug("listed-episodes", {
      creatorSlug: creatorModel.slug,
      count: listedEpisodes.length,
      sample: listedEpisodes.slice(0, 5).map((episode) => episode.title)
    });
    const bestListedEpisode = selectBestEpisodeMatch(context.title, listedEpisodes);

    if (bestListedEpisode) {
      debug("resolve-finish", {
        state: "video_match",
        source: "creator-listing",
        episode: bestListedEpisode.title
      });
      return createVideoMatch(creatorModel, this.toEpisodeModel(bestListedEpisode));
    }

    debug("resolve-finish", {
      state: "creator_fallback",
      creator: creatorModel.title
    });
    return createCreatorFallback(creatorModel);
  }

  toEpisodeModel(episode) {
    return {
      id: episode.id,
      title: episode.title,
      shareUrl: episode.share_url || `https://nebula.tv/${episode.app_path}/`,
      channelSlug: episode.channel_slug,
      publishedAt: episode.published_at
    };
  }

  extractCreatorsFromEpisodes(episodes) {
    const bySlug = new Map();

    for (const episode of episodes) {
      const slug = episode.channel_slug;

      if (!slug || bySlug.has(slug)) {
        continue;
      }

      bySlug.set(slug, {
        slug,
        app_path: episode.channel_slug,
        title: episode.channel_title,
        share_url: `https://nebula.tv/${episode.channel_slug}/`
      });
    }

    return [...bySlug.values()];
  }

  dedupeCreators(creators) {
    const bySlug = new Map();

    for (const creator of creators) {
      const slug = creator.slug || creator.app_path;

      if (!slug || bySlug.has(slug)) {
        continue;
      }

      bySlug.set(slug, creator);
    }

    return [...bySlug.values()];
  }

  async resolveCreatorModel(selectedCreator) {
    const selectedSlug = selectedCreator.slug || selectedCreator.app_path;
    debug("resolve-creator-model-start", {
      selectedSlug,
      selectedCreator
    });

    try {
      const creator = await this.getCreator(selectedSlug);
      const creatorSlug = creator.slug || creator.app_path;
      const creatorShareUrl = creator.share_url || `https://nebula.tv/${creator.app_path}/`;

      return {
        slug: creatorSlug,
        title: creator.title,
        appPath: creator.app_path,
        shareUrl: creatorShareUrl
      };
    } catch (error) {
      debug("resolve-creator-model-fallback", {
        selectedSlug,
        error: error instanceof Error ? error.message : String(error)
      });
      if (!(error instanceof Error) || !error.message.includes("404")) {
        throw error;
      }

      return {
        slug: selectedSlug,
        title: selectedCreator.title,
        appPath: selectedCreator.app_path || selectedSlug,
        shareUrl: selectedCreator.share_url || `https://nebula.tv/${selectedSlug}/`
      };
    }
  }
}

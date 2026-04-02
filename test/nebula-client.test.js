import test from "node:test";
import assert from "node:assert/strict";

import { NebulaClient } from "../src/extension/lib/nebula-client.js";

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

test("NebulaClient resolveMatch returns a video match from creator episode listings", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);

    if (url.includes("/video_episodes/search/")) {
      return createJsonResponse({
        results: []
      });
    }

    if (url.includes("/video_channels/search/")) {
      return createJsonResponse({
        results: [
          { title: "Phil Edwards", slug: "philedwards" }
        ]
      });
    }

    if (url.endsWith("/video_channels/philedwards/")) {
      return createJsonResponse({
        slug: "philedwards",
        title: "Phil Edwards",
        app_path: "philedwards",
        share_url: "https://nebula.tv/philedwards/"
      });
    }

    if (url.includes("/video_channels/philedwards/video_episodes/")) {
      return createJsonResponse({
        next: null,
        results: [
          {
            id: "video_episode:1",
            title: "The Secret Economics of Lego",
            channel_slug: "philedwards",
            share_url: "https://nebula.tv/videos/the-secret-economics-of-lego",
            published_at: "2024-01-01T00:00:00Z"
          }
        ]
      });
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const client = new NebulaClient(fetchImpl);
  const result = await client.resolveMatch({
    videoId: "abc123",
    title: "The Secret Economics of Lego",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/watch?v=abc123"
  });

  assert.equal(result.state, "video_match");
  assert.equal(result.targetUrl, "https://nebula.tv/videos/the-secret-economics-of-lego");
  assert.ok(calls.some((url) => url.includes("/video_channels/search/")));
});

test("NebulaClient resolveMatch falls back to creator page when no strong episode match exists", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/video_episodes/search/")) {
      return createJsonResponse({
        results: []
      });
    }

    if (url.includes("/video_channels/search/")) {
      return createJsonResponse({
        results: [
          { title: "Phil Edwards", slug: "philedwards" }
        ]
      });
    }

    if (url.endsWith("/video_channels/philedwards/")) {
      return createJsonResponse({
        slug: "philedwards",
        title: "Phil Edwards",
        app_path: "philedwards",
        share_url: "https://nebula.tv/philedwards/"
      });
    }

    if (url.includes("/video_channels/philedwards/video_episodes/")) {
      return createJsonResponse({
        next: null,
        results: [
          {
            id: "video_episode:1",
            title: "Brick History",
            channel_slug: "philedwards",
            share_url: "https://nebula.tv/videos/brick-history",
            published_at: "2024-01-01T00:00:00Z"
          }
        ]
      });
    }

    if (url.includes("/video_episodes/search/")) {
      return createJsonResponse({
        results: []
      });
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const client = new NebulaClient(fetchImpl);
  const result = await client.resolveMatch({
    videoId: "abc123",
    title: "The Secret Economics of Lego",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/watch?v=abc123"
  });

  assert.equal(result.state, "creator_fallback");
  assert.equal(result.targetUrl, "https://nebula.tv/philedwards/");
});

test("NebulaClient resolveMatch returns no_match when creator confidence is too low", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/video_episodes/search/")) {
      return createJsonResponse({
        results: []
      });
    }

    if (url.includes("/video_channels/search/")) {
      return createJsonResponse({
        results: [
          { title: "Second Thought", slug: "secondthought" }
        ]
      });
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const client = new NebulaClient(fetchImpl);
  const result = await client.resolveMatch({
    videoId: "abc123",
    title: "The Secret Economics of Lego",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/watch?v=abc123"
  });

  assert.equal(result.state, "no_match");
});

test("NebulaClient resolveMatch can recover when creator search is empty but episode search contains the right creator", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/video_episodes/search/")) {
      return createJsonResponse({
        results: [
          {
            id: "video_episode:1",
            title: "The Secret Economics of Lego",
            channel_slug: "philedwards",
            channel_title: "Phil Edwards",
            share_url: "https://nebula.tv/videos/the-secret-economics-of-lego",
            published_at: "2024-01-01T00:00:00Z"
          }
        ]
      });
    }

    if (url.includes("/video_channels/search/")) {
      return createJsonResponse({
        results: []
      });
    }

    if (url.endsWith("/video_channels/philedwards/")) {
      return createJsonResponse({
        slug: "philedwards",
        title: "Phil Edwards",
        app_path: "philedwards",
        share_url: "https://nebula.tv/philedwards/"
      });
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const client = new NebulaClient(fetchImpl);
  const result = await client.resolveMatch({
    videoId: "abc123",
    title: "The Secret Economics of Lego",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/watch?v=abc123"
  });

  assert.equal(result.state, "video_match");
  assert.equal(result.targetUrl, "https://nebula.tv/videos/the-secret-economics-of-lego");
});

test("NebulaClient resolveMatch returns a creator match for channel pages", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);

    if (url.includes("/video_channels/search/")) {
      return createJsonResponse({
        results: [
          { title: "Phil Edwards", slug: "philedwards" }
        ]
      });
    }

    if (url.endsWith("/video_channels/philedwards/")) {
      return createJsonResponse({
        slug: "philedwards",
        title: "Phil Edwards",
        app_path: "philedwards",
        share_url: "https://nebula.tv/philedwards/"
      });
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const client = new NebulaClient(fetchImpl);
  const result = await client.resolveMatch({
    pageType: "channel",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/@PhilEdwardsInc"
  });

  assert.equal(result.state, "creator_fallback");
  assert.equal(result.targetUrl, "https://nebula.tv/philedwards/");
  assert.deepEqual(
    calls.filter((url) => url.includes("/video_episodes/")),
    []
  );
});

test("NebulaClient resolveMatch returns no_match for channel pages with weak creator confidence", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/video_channels/search/")) {
      return createJsonResponse({
        results: [
          { title: "Second Thought", slug: "secondthought" }
        ]
      });
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const client = new NebulaClient(fetchImpl);
  const result = await client.resolveMatch({
    pageType: "channel",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/@PhilEdwardsInc"
  });

  assert.equal(result.state, "no_match");
});

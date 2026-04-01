import test from "node:test";
import assert from "node:assert/strict";

import {
  createCreatorFallback,
  createNoMatch,
  createVideoMatch,
  scoreNameMatch,
  scoreTitleMatch,
  selectBestCreatorMatch,
  selectBestEpisodeMatch
} from "../src/extension/lib/matching.js";
import { normalizeTitle } from "../src/extension/lib/text.js";

test("normalizeTitle removes trailing decorations and punctuation", () => {
  assert.equal(
    normalizeTitle("The Secret Economics of Lego | Extended Cut [Official Trailer]"),
    "the secret economics of lego"
  );
});

test("scoreNameMatch strongly favors exact creator names", () => {
  const exact = scoreNameMatch("Austin McConnell", "Austin McConnell");
  const near = scoreNameMatch("Austin McConnell", "Austin McConnel");
  const wrong = scoreNameMatch("Austin McConnell", "Second Thought");

  assert.equal(exact, 1);
  assert.ok(near > wrong);
  assert.ok(wrong < 0.45);
});

test("selectBestCreatorMatch accepts a clear creator winner", () => {
  const creators = [
    { title: "Austin McConnell", slug: "austinmcconnell", shareUrl: "https://nebula.tv/austinmcconnell/" },
    { title: "Austin Something Else", slug: "austinalt", shareUrl: "https://nebula.tv/austinalt/" }
  ];

  const result = selectBestCreatorMatch("Austin McConnell", creators);
  assert.equal(result.slug, "austinmcconnell");
});

test("selectBestCreatorMatch rejects weak creator candidates", () => {
  const creators = [
    { title: "Economics Explained", slug: "economics-explained" },
    { title: "Extra History", slug: "extra-history" }
  ];

  assert.equal(selectBestCreatorMatch("Phil Edwards", creators), null);
});

test("scoreTitleMatch rewards normalized exact titles", () => {
  const score = scoreTitleMatch(
    "Don’t Click That Private Video. It’s a Scam.",
    "Don't Click That Private Video. It's a Scam."
  );

  assert.ok(score > 0.95);
});

test("selectBestEpisodeMatch accepts a clear exact title match", () => {
  const episodes = [
    { title: "The Secret Economics of Lego", shareUrl: "https://nebula.tv/videos/lego" },
    { title: "The Secret Economics of Trains", shareUrl: "https://nebula.tv/videos/trains" }
  ];

  const result = selectBestEpisodeMatch("The Secret Economics of Lego", episodes);
  assert.equal(result.shareUrl, "https://nebula.tv/videos/lego");
});

test("selectBestEpisodeMatch rejects ambiguous close results", () => {
  const episodes = [
    { title: "The Hidden Growth of Cities", shareUrl: "https://nebula.tv/videos/cities-1" },
    { title: "Why Cities Keep Growing", shareUrl: "https://nebula.tv/videos/cities-2" }
  ];

  assert.equal(selectBestEpisodeMatch("How Cities Grow Over Time", episodes), null);
});

test("match result helpers produce the expected labels", () => {
  const creator = {
    slug: "phil-edwards",
    title: "Phil Edwards",
    shareUrl: "https://nebula.tv/philedwards/"
  };
  const episode = {
    id: "video_episode:123",
    title: "The Secret Economics of Lego",
    shareUrl: "https://nebula.tv/videos/the-secret-economics-of-lego"
  };

  assert.deepEqual(createNoMatch(), { state: "no_match" });
  assert.equal(createCreatorFallback(creator).label, "View creator on Nebula");
  assert.equal(createVideoMatch(creator, episode).label, "Watch on Nebula");
});

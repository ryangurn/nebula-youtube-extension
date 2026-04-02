import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const contentScriptPath = new URL("../src/extension/content.js", import.meta.url);
const contentScriptSource = readFileSync(contentScriptPath, "utf8");

class FakeElement {
  constructor(textContent = "") {
    this.textContent = textContent;
  }
}

class FakeMetaElement extends FakeElement {
  constructor(content) {
    super("");
    this.content = content;
  }
}

function loadContentHooks({
  href,
  querySelectors = {},
  elementsById = {}
}) {
  const document = {
    documentElement: {
      appendChild() {}
    },
    createElement() {
      return {
        appendChild() {},
        replaceChildren() {},
        setAttribute() {},
        dataset: {}
      };
    },
    getElementById(id) {
      return elementsById[id] || null;
    },
    querySelector(selector) {
      return querySelectors[selector] || null;
    }
  };

  const context = {
    console,
    URL,
    HTMLMetaElement: FakeMetaElement,
    MutationObserver: class {
      observe() {}
    },
    document,
    window: {
      location: {
        href
      },
      addEventListener() {},
      clearTimeout() {},
      setTimeout() {
        return 1;
      }
    },
    globalThis: null,
    __NEBULA_ENABLE_TEST_HOOKS__: true,
    __NEBULA_SKIP_BOOTSTRAP__: true
  };

  context.globalThis = context;
  vm.runInNewContext(contentScriptSource, context);
  return context.__NEBULA_CONTENT_TEST_HOOKS__;
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("content helpers detect watch pages and build watch context", () => {
  const hooks = loadContentHooks({
    href: "https://www.youtube.com/watch?v=abc123",
    querySelectors: {
      "ytd-watch-metadata h1 yt-formatted-string": new FakeElement("The Secret Economics of Lego"),
      "ytd-watch-metadata #owner #channel-name a": new FakeElement("Phil Edwards"),
      "ytd-watch-metadata ytd-menu-renderer #top-level-buttons-computed": new FakeElement("")
    }
  });

  assert.equal(hooks.getCurrentPageType(), "watch");
  assert.deepEqual(toPlain(hooks.getCurrentContext()), {
    pageType: "watch",
    videoId: "abc123",
    title: "The Secret Economics of Lego",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/watch?v=abc123"
  });
  assert.equal(hooks.isPageReady("watch"), true);
});

test("content helpers detect channel pages and build channel context", () => {
  const hooks = loadContentHooks({
    href: "https://www.youtube.com/@PhilEdwardsInc",
    querySelectors: {
      "ytd-c4-tabbed-header-renderer #channel-name yt-formatted-string": new FakeElement("Phil Edwards"),
      "yt-flexible-actions-view-model #actions": new FakeElement("")
    }
  });

  assert.equal(hooks.getCurrentPageType(), "channel");
  assert.deepEqual(toPlain(hooks.getCurrentContext()), {
    pageType: "channel",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/@PhilEdwardsInc"
  });
  assert.equal(hooks.getContextKey(hooks.getCurrentContext()), "channel:/@PhilEdwardsInc");
  assert.equal(hooks.isPageReady("channel"), true);
});

test("content helpers support og:title fallback for channel pages", () => {
  const hooks = loadContentHooks({
    href: "https://www.youtube.com/channel/UC123",
    querySelectors: {
      "meta[property='og:title']": new FakeMetaElement("Phil Edwards"),
      "ytd-c4-tabbed-header-renderer #buttons": new FakeElement("")
    }
  });

  assert.equal(hooks.getCurrentPageType(), "channel");
  assert.deepEqual(toPlain(hooks.getCurrentContext()), {
    pageType: "channel",
    channelName: "Phil Edwards",
    url: "https://www.youtube.com/channel/UC123"
  });
});

test("content helpers return null on unsupported pages", () => {
  const hooks = loadContentHooks({
    href: "https://www.youtube.com/results?search_query=nebula"
  });

  assert.equal(hooks.getCurrentPageType(), null);
  assert.equal(hooks.getCurrentContext(), null);
  assert.equal(hooks.isPageReady("channel"), false);
});

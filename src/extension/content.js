(function bootstrapNebulaButton() {
  const BUTTON_HOST_ID = "nebula-youtube-button-host";
  const BUTTON_LINK_ID = "nebula-youtube-button-link";
  const BUTTON_TEXT_ID = "nebula-youtube-button-text";
  const STYLE_ID = "nebula-youtube-button-style";
  const REQUEST_DEBOUNCE_MS = 350;
  const DEBUG_PREFIX = "[Nebula Match]";
  const runtimeApi = globalThis.NebulaExtensionRuntime;

  let lastResolvedPageKey = null;
  let requestTimer = null;

  function debug(...args) {
    console.debug(DEBUG_PREFIX, ...args);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_HOST_ID} {
        display: inline-flex;
        align-items: center;
        margin-right: 8px;
      }

      #${BUTTON_LINK_ID} {
        align-items: center;
        appearance: none;
        background: var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05));
        border: none;
        border-radius: 999px;
        color: var(--yt-spec-text-primary, #0f0f0f);
        cursor: pointer;
        display: inline-flex;
        font-family: "Roboto", "Arial", sans-serif;
        font-size: 1.4rem;
        font-weight: 500;
        gap: 8px;
        line-height: 3.6rem;
        min-height: 36px;
        padding: 0 16px;
        text-decoration: none;
        white-space: nowrap;
      }

      html[dark] #${BUTTON_LINK_ID} {
        background: rgba(255, 255, 255, 0.1);
        color: #f1f1f1;
      }

      #${BUTTON_LINK_ID}:hover {
        background: var(--yt-spec-badge-chip-background-hover, rgba(0, 0, 0, 0.1));
      }

      html[dark] #${BUTTON_LINK_ID}:hover {
        background: rgba(255, 255, 255, 0.16);
      }

      #${BUTTON_LINK_ID}:focus-visible {
        outline: 2px solid #3ea6ff;
        outline-offset: 2px;
      }

      #${BUTTON_LINK_ID}[data-state="creator_fallback"]::before,
      #${BUTTON_LINK_ID}[data-state="video_match"]::before {
        background: #ff4e45;
        border-radius: 50%;
        content: "";
        display: inline-block;
        flex: 0 0 auto;
        height: 8px;
        width: 8px;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function getCurrentUrl() {
    return new URL(window.location.href);
  }

  function isWatchPage(url) {
    return url.pathname === "/watch" && Boolean(url.searchParams.get("v"));
  }

  function isChannelPage(url) {
    return (
      /^\/@[^/]+/.test(url.pathname) ||
      url.pathname.startsWith("/channel/") ||
      url.pathname.startsWith("/c/")
    );
  }

  function getCurrentPageType() {
    const url = getCurrentUrl();

    if (isWatchPage(url)) {
      return "watch";
    }

    if (isChannelPage(url)) {
      return "channel";
    }

    return null;
  }

  function getVideoIdFromLocation() {
    const url = getCurrentUrl();
    return isWatchPage(url) ? url.searchParams.get("v") : null;
  }

  function getWatchTitleNode() {
    return (
      document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ||
      document.querySelector("ytd-watch-metadata h1.inline-metadata-item") ||
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("h1.style-scope.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("meta[property='og:title']")
    );
  }

  function getWatchChannelNode() {
    return (
      document.querySelector("ytd-watch-metadata #owner #channel-name a") ||
      document.querySelector("ytd-watch-metadata #channel-name a") ||
      document.querySelector("ytd-watch-metadata #owner #channel-name yt-formatted-string") ||
      document.querySelector("ytd-watch-metadata ytd-channel-name #text a") ||
      document.querySelector("ytd-watch-metadata ytd-channel-name #text") ||
      document.querySelector("ytd-video-owner-renderer #channel-name a") ||
      document.querySelector("ytd-video-owner-renderer ytd-channel-name #text a") ||
      document.querySelector("ytd-watch-metadata #owner a")
    );
  }

  function getChannelNameNode() {
    return (
      document.querySelector("ytd-c4-tabbed-header-renderer #channel-name yt-formatted-string") ||
      document.querySelector("ytd-c4-tabbed-header-renderer #channel-name") ||
      document.querySelector("yt-page-header-view-model h1 yt-formatted-string") ||
      document.querySelector("yt-page-header-view-model h1") ||
      document.querySelector("yt-dynamic-text-view-model h1") ||
      document.querySelector("meta[property='og:title']")
    );
  }

  function getTextFromNode(node) {
    if (node instanceof HTMLMetaElement) {
      return node.content?.trim() || null;
    }

    return node?.textContent?.trim() || null;
  }

  function getVideoContext() {
    const videoId = getVideoIdFromLocation();

    if (!videoId) {
      return null;
    }

    const title = getTextFromNode(getWatchTitleNode());
    const channelName = getTextFromNode(getWatchChannelNode());

    if (!title || !channelName) {
      debug("Video context incomplete", {
        videoId,
        hasTitle: Boolean(title),
        hasChannelName: Boolean(channelName)
      });
      return null;
    }

    debug("Resolved watch context", {
      videoId,
      title,
      channelName
    });

    return {
      pageType: "watch",
      videoId,
      title,
      channelName,
      url: window.location.href
    };
  }

  function getChannelContext() {
    const url = getCurrentUrl();

    if (!isChannelPage(url)) {
      return null;
    }

    const channelName = getTextFromNode(getChannelNameNode());

    if (!channelName) {
      debug("Channel context incomplete", {
        pathname: url.pathname
      });
      return null;
    }

    debug("Resolved channel context", {
      channelName,
      pathname: url.pathname
    });

    return {
      pageType: "channel",
      channelName,
      url: window.location.href
    };
  }

  function getCurrentContext() {
    const pageType = getCurrentPageType();

    if (pageType === "watch") {
      return getVideoContext();
    }

    if (pageType === "channel") {
      return getChannelContext();
    }

    return null;
  }

  function getWatchActionRow() {
    return (
      document.querySelector("ytd-watch-metadata ytd-menu-renderer #top-level-buttons-computed") ||
      document.querySelector("ytd-menu-renderer #top-level-buttons-computed") ||
      document.querySelector("ytd-watch-metadata #top-level-buttons-computed") ||
      document.querySelector("#top-level-buttons-computed")
    );
  }

  function getChannelActionRow() {
    return (
      document.querySelector("yt-flexible-actions-view-model #actions") ||
      document.querySelector("yt-flexible-actions-view-model") ||
      document.querySelector("yt-page-header-view-model #actions") ||
      document.querySelector("ytd-c4-tabbed-header-renderer #buttons.ytd-c4-tabbed-header-renderer") ||
      document.querySelector("ytd-c4-tabbed-header-renderer #buttons")
    );
  }

  function getActionRowForPageType(pageType) {
    if (pageType === "watch") {
      return getWatchActionRow();
    }

    if (pageType === "channel") {
      return getChannelActionRow();
    }

    return null;
  }

  function removeInjectedButton() {
    const existing = document.getElementById(BUTTON_HOST_ID);

    if (existing) {
      existing.remove();
    }
  }

  function ensureButtonHost(actionRow) {
    let host = document.getElementById(BUTTON_HOST_ID);

    if (host && host.parentElement !== actionRow) {
      host.remove();
      host = null;
    }

    if (!host) {
      host = document.createElement("div");
      host.id = BUTTON_HOST_ID;
      actionRow.prepend(host);
    }

    return host;
  }

  function renderButton(pageType, result) {
    const actionRow = getActionRowForPageType(pageType);

    if (!actionRow || result.state === "no_match") {
      debug("No button rendered", {
        pageType,
        hasActionRow: Boolean(actionRow),
        state: result.state
      });
      removeInjectedButton();
      return;
    }

    const host = ensureButtonHost(actionRow);
    const anchor = document.createElement("a");
    const label = document.createElement("span");

    anchor.id = BUTTON_LINK_ID;
    anchor.href = result.targetUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.dataset.state = result.state;
    anchor.setAttribute("aria-label", result.label);
    anchor.title = result.label;

    label.id = BUTTON_TEXT_ID;
    label.textContent = result.label;

    anchor.appendChild(label);
    host.replaceChildren(anchor);
    debug("Rendered button", {
      pageType,
      result
    });
  }

  function getContextKey(context) {
    if (!context) {
      return null;
    }

    if (context.pageType === "watch") {
      return `watch:${context.videoId}`;
    }

    return `channel:${new URL(context.url).pathname}`;
  }

  function resolveNebulaMatch(context) {
    debug("Requesting Nebula match", {
      ...context,
      environment: runtimeApi?.getEnvironment?.()
    });

    if (!runtimeApi) {
      debug("Nebula runtime helper is unavailable");
      return Promise.resolve({ state: "no_match" });
    }

    return runtimeApi
      .sendMessage({
        type: "resolve-nebula-match",
        context
      })
      .then((response) => {
        if (!response || !response.ok) {
          debug("Nebula match request failed", {
            response
          });
          return { state: "no_match" };
        }

        debug("Nebula match response", response.result);
        return response.result || { state: "no_match" };
      })
      .catch((error) => {
        debug("Nebula match request threw", runtimeApi.serializeError(error));
        return { state: "no_match" };
      });
  }

  async function refreshForCurrentPage() {
    const context = getCurrentContext();

    if (!context) {
      lastResolvedPageKey = null;
      removeInjectedButton();
      return;
    }

    const contextKey = getContextKey(context);

    if (contextKey === lastResolvedPageKey && document.getElementById(BUTTON_HOST_ID)) {
      debug("Skipping refresh for already-rendered page", contextKey);
      return;
    }

    lastResolvedPageKey = contextKey;
    const result = await resolveNebulaMatch(context);

    if (contextKey !== getContextKey(getCurrentContext())) {
      debug("Skipping stale render", {
        contextKey
      });
      return;
    }

    renderButton(context.pageType, result);
  }

  function isPageReady(pageType) {
    if (pageType === "watch") {
      return Boolean(getWatchTitleNode() && getWatchChannelNode() && getWatchActionRow());
    }

    if (pageType === "channel") {
      return Boolean(getChannelNameNode() && getChannelActionRow());
    }

    return false;
  }

  function scheduleRefresh() {
    window.clearTimeout(requestTimer);
    requestTimer = window.setTimeout(() => {
      debug("Running scheduled refresh", {
        pageType: getCurrentPageType()
      });
      refreshForCurrentPage().catch((error) => {
        console.error("Nebula button refresh failed", error);
        removeInjectedButton();
      });
    }, REQUEST_DEBOUNCE_MS);
  }

  function watchForPageChanges() {
    const observer = new MutationObserver(() => {
      const pageType = getCurrentPageType();

      if (!pageType) {
        removeInjectedButton();
        lastResolvedPageKey = null;
        return;
      }

      if (isPageReady(pageType)) {
        debug("Detected YouTube DOM ready state", {
          pageType
        });
        scheduleRefresh();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function bindNavigationEvents() {
    window.addEventListener("yt-navigate-finish", () => {
      debug("yt-navigate-finish");
      scheduleRefresh();
    });
    window.addEventListener("popstate", () => {
      debug("popstate");
      scheduleRefresh();
    });
  }

  function installTestHooks() {
    if (!globalThis.__NEBULA_ENABLE_TEST_HOOKS__) {
      return;
    }

    globalThis.__NEBULA_CONTENT_TEST_HOOKS__ = {
      getCurrentContext,
      getCurrentPageType,
      getActionRowForPageType,
      getContextKey,
      isChannelPage,
      isPageReady,
      isWatchPage
    };
  }

  installTestHooks();

  if (globalThis.__NEBULA_SKIP_BOOTSTRAP__) {
    return;
  }

  debug("Content script booted");
  injectStyles();
  bindNavigationEvents();
  watchForPageChanges();
  scheduleRefresh();
})();

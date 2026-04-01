(function bootstrapNebulaButton() {
  const BUTTON_HOST_ID = "nebula-youtube-button-host";
  const BUTTON_LINK_ID = "nebula-youtube-button-link";
  const BUTTON_TEXT_ID = "nebula-youtube-button-text";
  const STYLE_ID = "nebula-youtube-button-style";
  const REQUEST_DEBOUNCE_MS = 350;
  const DEBUG_PREFIX = "[Nebula Match]";

  let lastResolvedVideoId = null;
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

  function isWatchPage(url) {
    return url.pathname === "/watch" && Boolean(url.searchParams.get("v"));
  }

  function getVideoIdFromLocation() {
    const url = new URL(window.location.href);
    return isWatchPage(url) ? url.searchParams.get("v") : null;
  }

  function getVideoContext() {
    const videoId = getVideoIdFromLocation();

    if (!videoId) {
      return null;
    }

    const titleNode =
      document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ||
      document.querySelector("ytd-watch-metadata h1.inline-metadata-item") ||
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("h1.style-scope.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("meta[property='og:title']");

    const channelNode =
      document.querySelector("ytd-watch-metadata #owner #channel-name a") ||
      document.querySelector("ytd-watch-metadata #channel-name a") ||
      document.querySelector("ytd-watch-metadata #owner #channel-name yt-formatted-string") ||
      document.querySelector("ytd-watch-metadata ytd-channel-name #text a") ||
      document.querySelector("ytd-watch-metadata ytd-channel-name #text") ||
      document.querySelector("ytd-video-owner-renderer #channel-name a") ||
      document.querySelector("ytd-video-owner-renderer ytd-channel-name #text a") ||
      document.querySelector("ytd-watch-metadata #owner a");

    const title =
      titleNode instanceof HTMLMetaElement
        ? titleNode.content
        : titleNode?.textContent?.trim();
    const channelName = channelNode?.textContent?.trim();

    if (!title || !channelName) {
      debug("Video context incomplete", {
        videoId,
        hasTitle: Boolean(title),
        hasChannelName: Boolean(channelName)
      });
      return null;
    }

    debug("Resolved YouTube context", {
      videoId,
      title,
      channelName
    });

    return {
      videoId,
      title,
      channelName,
      url: window.location.href
    };
  }

  function getActionRow() {
    return (
      document.querySelector("ytd-watch-metadata ytd-menu-renderer #top-level-buttons-computed") ||
      document.querySelector("ytd-menu-renderer #top-level-buttons-computed") ||
      document.querySelector("ytd-watch-metadata #top-level-buttons-computed") ||
      document.querySelector("#top-level-buttons-computed")
    );
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

  function renderButton(result) {
    const actionRow = getActionRow();

    if (!actionRow || result.state === "no_match") {
      debug("No button rendered", {
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
    debug("Rendered button", result);
  }

  function resolveNebulaMatch(context) {
    return new Promise((resolve) => {
      debug("Requesting Nebula match", context);
      chrome.runtime.sendMessage(
        {
          type: "resolve-nebula-match",
          context
        },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.ok) {
            debug("Nebula match request failed", {
              runtimeError: chrome.runtime.lastError?.message,
              response
            });
            resolve({ state: "no_match" });
            return;
          }

          debug("Nebula match response", response.result);
          resolve(response.result || { state: "no_match" });
        }
      );
    });
  }

  async function refreshForCurrentVideo() {
    const context = getVideoContext();

    if (!context) {
      lastResolvedVideoId = null;
      removeInjectedButton();
      return;
    }

    if (context.videoId === lastResolvedVideoId && document.getElementById(BUTTON_HOST_ID)) {
      debug("Skipping refresh for already-rendered video", context.videoId);
      return;
    }

    lastResolvedVideoId = context.videoId;
    const result = await resolveNebulaMatch(context);

    if (context.videoId !== getVideoIdFromLocation()) {
      return;
    }

    renderButton(result);
  }

  function scheduleRefresh() {
    window.clearTimeout(requestTimer);
    requestTimer = window.setTimeout(() => {
      debug("Running scheduled refresh");
      refreshForCurrentVideo().catch((error) => {
        console.error("Nebula button refresh failed", error);
        removeInjectedButton();
      });
    }, REQUEST_DEBOUNCE_MS);
  }

  function watchForPageChanges() {
    const observer = new MutationObserver(() => {
      const videoId = getVideoIdFromLocation();

      if (!videoId) {
        removeInjectedButton();
        lastResolvedVideoId = null;
        return;
      }

      const titleReady = Boolean(
        document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ||
        document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
      );
      const channelReady = Boolean(
        document.querySelector("ytd-watch-metadata #owner #channel-name a") ||
        document.querySelector("ytd-video-owner-renderer #channel-name a")
      );
      const buttonRowReady = Boolean(getActionRow());

      if (titleReady && channelReady && buttonRowReady) {
        debug("Detected YouTube DOM ready state");
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

  debug("Content script booted");
  injectStyles();
  bindNavigationEvents();
  watchForPageChanges();
  scheduleRefresh();
})();

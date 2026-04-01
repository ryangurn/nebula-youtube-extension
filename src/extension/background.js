import { NebulaClient } from "./lib/nebula-client.js";

const nebulaClient = new NebulaClient();

function debug(event, payload) {
  console.debug("[Nebula Match][background]", event, payload);
}

debug("service-worker-loaded", {
  location: self.location.href
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debug("message-received", {
    type: message?.type,
    sender: {
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      frameId: sender.frameId
    }
  });

  if (!message || message.type !== "resolve-nebula-match") {
    debug("message-ignored", message);
    return false;
  }

  nebulaClient
    .resolveMatch(message.context)
    .then((result) => {
      debug("message-resolved", result);
      sendResponse({
        ok: true,
        result
      });
    })
    .catch((error) => {
      console.error("Nebula match resolution failed", {
        error: error instanceof Error ? error.message : String(error),
        sender
      });
      debug("message-failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null
      });

      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  return true;
});

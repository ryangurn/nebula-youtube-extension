import "./lib/runtime.js";
import { NebulaClient } from "./lib/nebula-client.js";

const nebulaClient = new NebulaClient();
const runtimeApi = globalThis.NebulaExtensionRuntime;

function debug(event, payload) {
  console.debug("[Nebula Match][background]", event, payload);
}

debug("service-worker-loaded", {
  location: self.location.href,
  environment: runtimeApi.getEnvironment()
});

runtimeApi.addMessageListener(async (message, sender) => {
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
    return undefined;
  }

  try {
    const result = await nebulaClient.resolveMatch(message.context);
    debug("message-resolved", result);
    return {
      ok: true,
      result
    };
  } catch (error) {
    console.error("Nebula match resolution failed", {
      error: error instanceof Error ? error.message : String(error),
      sender
    });
    debug("message-failed", runtimeApi.serializeError(error));

    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

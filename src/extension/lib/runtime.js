(function installNebulaExtensionRuntime(globalScope) {
  if (globalScope.NebulaExtensionRuntime) {
    return;
  }

  const extensionApi = globalScope.browser ?? globalScope.chrome ?? null;

  function detectMessagingMode() {
    if (globalScope.browser?.runtime?.sendMessage) {
      return "promise";
    }

    if (globalScope.chrome?.runtime?.sendMessage) {
      return "callback";
    }

    return "unavailable";
  }

  function getRuntime() {
    return extensionApi?.runtime ?? null;
  }

  function serializeError(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack ?? null
      };
    }

    return {
      message: String(error),
      stack: null
    };
  }

  function createRuntimeUnavailableError() {
    return new Error("Extension runtime API is unavailable in this browser context.");
  }

  const runtimeApi = {
    getEnvironment() {
      return {
        apiNamespace: globalScope.browser ? "browser" : globalScope.chrome ? "chrome" : "none",
        messagingMode: detectMessagingMode()
      };
    },

    getRuntime,

    addMessageListener(handler) {
      const runtime = getRuntime();

      if (!runtime?.onMessage?.addListener) {
        throw createRuntimeUnavailableError();
      }

      if (detectMessagingMode() === "promise") {
        runtime.onMessage.addListener((message, sender) => handler(message, sender));
        return;
      }

      runtime.onMessage.addListener((message, sender, sendResponse) => {
        Promise.resolve()
          .then(() => handler(message, sender))
          .then((response) => {
            sendResponse(response);
          })
          .catch((error) => {
            const details = serializeError(error);
            sendResponse({
              ok: false,
              error: details.message
            });
          });

        return true;
      });
    },

    async sendMessage(message) {
      const runtime = getRuntime();

      if (!runtime?.sendMessage) {
        throw createRuntimeUnavailableError();
      }

      if (detectMessagingMode() === "promise") {
        return runtime.sendMessage(message);
      }

      return new Promise((resolve) => {
        runtime.sendMessage(message, (response) => {
          const lastError = runtime.lastError ?? globalScope.chrome?.runtime?.lastError ?? null;

          if (lastError) {
            resolve({
              ok: false,
              error: lastError.message
            });
            return;
          }

          resolve(response);
        });
      });
    },

    serializeError
  };

  Object.defineProperty(globalScope, "NebulaExtensionRuntime", {
    value: runtimeApi,
    configurable: false,
    writable: false
  });
})(globalThis);

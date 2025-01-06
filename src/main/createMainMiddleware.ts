import type { Action, Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import { ipcMain, webContents, type IpcMainEvent } from "electron";

import { getMiddlewareForwarder } from "../internal.js";
import {
  IpcChannel,
  type IDisposable,
  type RedialMiddlewareHooks,
} from "../types.js";

type HandlerName = "forwardAction" | "asyncStateRequest" | "syncStateRequest";

/**
 * Return value for the main middleware that adheres to the Middleware API and
 * provides a `dispose` method that can be called to free resources.
 */
export type RedialMainMiddleware = Middleware & IDisposable;

/**
 * Creates middleware that forwards dispatched actions to the renderer process
 * to ensure global state is in sync. The optional `hooks` argument allows you
 * to make changes to the action prior to forwarding and after forwarding before
 * passing the action to the next middlewares.
 *
 * @param [hooks] Optional hooks to run before and after the action is forwarded.
 *
 * @returns Middleware with a `dispose` method for cleaning up any IPC event listeners.
 *
 * @example
 * import { createRedialMainMiddleware } from "@laserware/redial/main";
 * import { configureStore, type Store } from "@reduxjs/toolkit";
 * import { app } from "electron";
 *
 * import { rootReducer } from "../common/rootReducer";
 *
 * export function createStore(): Store {
 *   const redialMiddleware = createRedialMainMiddleware();
 *
 *   const store = configureStore({
 *     reducer: rootReducer,
 *     middleware: (getDefaultMiddleware) =>
 *       getDefaultMiddleware().concat(redialMiddleware),
 *   });
 *
 *   app.on("before-quit", () => {
 *     // Perform cleanup:
 *     redialMiddleware.dispose();
 *   });
 * }
 */
export function createRedialMainMiddleware(
  hooks?: RedialMiddlewareHooks,
): RedialMainMiddleware {
  const forwarder = getMiddlewareForwarder(hooks);

  const disposables = new Map<HandlerName, IDisposable | undefined>([
    ["forwardAction", undefined],
    ["asyncStateRequest", undefined],
    ["syncStateRequest", undefined],
  ]);

  const middleware = (api: MiddlewareAPI) => {
    if (disposables.get("forwardAction") === undefined) {
      disposables.set("forwardAction", handleForwardedAction(api));
    }

    if (disposables.get("asyncStateRequest") === undefined) {
      disposables.set("asyncStateRequest", handleAsyncStateRequests(api));
    }

    if (disposables.get("syncStateRequest") === undefined) {
      disposables.set("syncStateRequest", handleSyncStateRequests(api));
    }

    // Forward actions to the renderer process:
    return (next) => (action) => {
      return forwarder(next, action, (redialAction) => {
        for (const contentWindow of webContents.getAllWebContents()) {
          contentWindow.send(IpcChannel.FromMain, redialAction);
        }
      });
    };
  };

  const dispose = (): void => {
    for (const disposable of disposables.values()) {
      disposable?.dispose();
    }
  };

  return Object.assign(middleware, { dispose });
}

/**
 * Adds a listener to dispatch an action forwarded from the renderer process.
 * Returns a disposable that can be called via the `dispose` method of the middleware.
 *
 * @internal
 */
function handleForwardedAction(api: MiddlewareAPI): IDisposable {
  const handleAction = (event: IpcMainEvent, action: Action): void => {
    api.dispatch(action);
  };

  ipcMain.addListener(IpcChannel.FromRenderer, handleAction);

  return {
    dispose() {
      ipcMain.removeListener(IpcChannel.FromRenderer, handleAction);
    },
  };
}

/**
 * Adds a handler that asynchronously returns the current state to the renderer
 * process when invoked. Returns a disposable that can be called via the `dispose`
 * method of the middleware.
 *
 * @internal
 */
function handleAsyncStateRequests(api: MiddlewareAPI): IDisposable {
  const handleAsyncRequest = (): void => {
    return api.getState();
  };

  ipcMain.handle(IpcChannel.ForStateAsync, handleAsyncRequest);

  return {
    dispose() {
      ipcMain.removeHandler(IpcChannel.ForStateAsync);
    },
  };
}

/**
 * Adds a listener that synchronously returns the current state to the renderer
 * process when requested. Returns a disposable that can be called via the
 * `dispose` method of the middleware.
 *
 * @internal
 */
function handleSyncStateRequests(api: MiddlewareAPI): IDisposable {
  const handleSyncRequest = (event: IpcMainEvent): void => {
    event.returnValue = api.getState();
  };

  ipcMain.addListener(IpcChannel.ForStateSync, handleSyncRequest);

  return {
    dispose() {
      ipcMain.removeListener(IpcChannel.ForStateSync, handleSyncRequest);
    },
  };
}

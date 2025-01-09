import type { Action, Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import type { IpcRendererEvent } from "electron";

import {
  type RedialMainWorldApi,
  getMiddlewareForwarder,
  redialMainWorldApiKey,
} from "../internal.js";
import type { AnyState, IDisposable, RedialMiddlewareHooks } from "../types.js";

/**
 * Redial middleware in the renderer process. Provides a `dispose` method to
 * clean up resources as well as methods to get the state from the main
 * process asynchronously or synchronously.
 */
export interface RedialRendererMiddleware extends Middleware, IDisposable {
  /**
   * Returns the current state from the main process asynchronously. This is
   * useful for syncing the state with the renderer in development mode (i.e.
   * persisting state after refreshing the page). Use this if you don't want
   * to block the main thread while requesting state.
   *
   * @template S Redux state definition.
   *
   * @returns Promise that resolves with the current state from the main process.
   */
  getMainState<S extends AnyState = AnyState>(): Promise<S>;

  /**
   * Returns the current state from the main process synchronously. This is
   * useful for syncing the state with the renderer in development mode (i.e.
   * persisting state after refreshing the page).
   *
   * > [!CAUTION]
   * > This will block the main thread until the state is returned from the
   * > main process. You should only use this in development to keep state
   * > synchronized between reloads of the renderer process.
   * >
   * > If you want to get the state without blocking the main thread, you can use
   * > the {@linkcode getMainState} method.
   *
   * @template S Redux state definition.
   *
   * @returns Current state from the main process.
   */
  getMainStateSync<S extends AnyState = AnyState>(): S;
}

/**
 * Whenever an action is fired from the renderer process, forward it to the
 * main process to ensure global state is in sync. The optional `hooks`
 * argument allows you to make changes to the action prior to forwarding it to
 * the main process and after forwarding to the main process before passing the
 * action to the next middlewares.
 *
 * @param [hooks] Optional hooks to run before and after the action is forwarded.
 *
 * @returns Middleware with a `dispose` method for cleaning up any IPC event listeners.
 *
 * @example
 * import { createRedialRendererMiddleware } from "@laserware/redial/renderer";
 * import { configureStore, type Store } from "@reduxjs/toolkit";
 *
 * import { rootReducer } from "../common/rootReducer";
 *
 * export function createStore(): Store {
 *   const redialMiddleware = createRedialRendererMiddleware({
 *     // Ensure payload is serialized before sending:
 *     beforeSend(action) {
 *       // In Svelte, a `$state()` Rune turns an object into a Proxy, which is
 *       // not serializable, so you need to convert it back to an object before
 *       // sending it to the main process:
 *       if (action.payload !== undefined) {
 *         action.payload = JSON.parse(JSON.stringify(action.payload));
 *       }
 *
 *       return action;
 *     },
 *
 *     // You can use the afterSend hook to make changes to the action before
 *     // it gets sent to the next middleware:
 *     afterSend(action) {
 *       action.meta.timestamp = Date.now();
 *
 *       return action;
 *     }
 *   });
 *
 *   let preloadedState;
 *   // If using Vite:
 *   if (import.meta.env.MODE === "development") {
 *     preloadedState = redialMiddleware.getMainStateSync();
 *   }
 *
 *   const store = configureStore({
 *     preloadedState,
 *     reducer: rootReducer,
 *     middleware: (getDefaultMiddleware) =>
 *       getDefaultMiddleware().concat(redialMiddleware),
 *   });
 * }
 */
export function createRedialRendererMiddleware(
  hooks?: RedialMiddlewareHooks,
): RedialRendererMiddleware {
  const forwarder = getMiddlewareForwarder(hooks);

  // biome-ignore format:
  const redialMainWorldApi: RedialMainWorldApi = globalThis[redialMainWorldApiKey];

  if (redialMainWorldApi === undefined) {
    // biome-ignore format:
    const message = [
      "Unable to configure middleware in the renderer process.",
      "You may have forgotten to call `exposeRedialInMainWorld` in a preload script from the main process.",
    ].join(" ");

    throw new Error(message);
  }

  let disposable: IDisposable | null = null;

  const middleware = (api: MiddlewareAPI) => {
    if (disposable === null) {
      disposable = handleForwardedAction(redialMainWorldApi, api);
    }

    // Forward actions to the main process:
    return (next) => (action) => {
      return forwarder(next, action, (redialAction) => {
        redialMainWorldApi.forwardActionToMain(redialAction);
      });
    };
  };

  const dispose = (): void => {
    disposable?.dispose();
  };

  const getMainState = async <S extends AnyState = AnyState>(): Promise<S> => {
    return await redialMainWorldApi.requestMainStateAsync();
  };

  const getMainStateSync = <S extends AnyState = AnyState>(): S => {
    return redialMainWorldApi.requestMainStateSync();
  };

  return Object.assign(middleware, {
    dispose,
    getMainState,
    getMainStateSync,
  });
}

function handleForwardedAction(
  redialMainWorldApi: RedialMainWorldApi,
  api: MiddlewareAPI,
): IDisposable {
  const handleAction = (event: IpcRendererEvent, action: Action): void => {
    api.dispatch(action);
  };

  redialMainWorldApi.addMainActionListener(handleAction);

  return {
    dispose() {
      redialMainWorldApi.removeMainActionListener(handleAction);
    },
  };
}

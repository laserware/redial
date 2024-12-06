import type { Store } from "@laserware/stasis";

import {
  getCreateForwardToMainMiddleware,
  getCreateForwardToRendererMiddleware,
  type CreateForwardingMiddlewareFunction,
} from "./middleware.js";
import { getReplayActionInMain, getReplayActionInRenderer } from "./replay.js";
import {
  getListenForStateRequests,
  getRequestStateFromMain,
} from "./syncState.js";
import type {
  AnyState,
  ElectronApiIn,
  ElectronMainApi,
  ElectronRendererApi,
  ProcessName,
} from "./types.js";

/**
 * Object available as the argument in the {@linkcode withRedial} initializer
 * function in the <i>main</i> process.
 *
 * @template S Type definition for Redux state.
 */
export type RedialMainInit<S> = {
  /**
   * Creates the forwarding middleware that forwards dispatched actions to the
   * <i>renderer</i> process.
   */
  createForwardingMiddleware: CreateForwardingMiddlewareFunction;

  /**
   * Replays the dispatched action from the <i>renderer</i> process in the
   * <i>main</i> process.
   *
   * @param store Redux store instance.
   */
  replayAction: (store: Store<S>) => void;

  /**
   * Synchronously sends the current state to the <i>renderer</i> process when
   * requested via {@linkcode RedialRendererInit.requestState}. This is
   * useful for preserving state between reloads in the <i>renderer</i> process.
   *
   * @param store Redux store instance.
   */
  listenForStateRequests: (store: Store<S>) => void;
};

/**
 * Object available as the argument in the {@linkcode withRedial} initializer
 * function in the <i>renderer</i> process.
 *
 * @template S Type definition for Redux state.
 */
export type RedialRendererInit<S> = {
  /**
   * Creates the forwarding middleware that forwards dispatched actions to the
   * <i>main</i> process.
   */
  createForwardingMiddleware: CreateForwardingMiddlewareFunction;

  /**
   * Replays the dispatched action from the <i>main</i> process in the
   * <i>renderer</i> process.
   *
   * @param store Redux store instance.
   */
  replayAction: (store: Store<S>) => void;

  /**
   * Synchronously request state from the <i>main</i> process.
   *
   * **Important Note**
   *
   * This will block the main thread until the state is returned from the
   * <i>main</i> process. You should only use this in development to keep state
   * synchronized between reloads of the <i>renderer</i> process.
   */
  requestState: () => S | undefined;
};

/**
 * Init options for the {@linkcode withRedial} initializer function based on
 * the {@linkcode ProcessName}.
 */
export type RedialInit<
  S extends AnyState,
  PN extends ProcessName,
> = PN extends "main"
  ? RedialMainInit<S>
  : PN extends "renderer"
    ? RedialRendererInit<S>
    : never;

/**
 * Convenience wrapper to provide the APIs for Electron IPC middleware when
 * configuring the Redux store.
 *
 * Note that you _must_ return the Redux store from the `initializer` callback.
 *
 * @template S Type definition for Redux state.
 * @template PN Process name in which to create store.
 *
 * @param processName Process name in which to create store (`"main"` or `"renderer"`).
 * @param electronApi Electron API for the process scope.
 * @param initializer Callback with Electron IPC middleware APIs as the `options` argument.
 *
 * @example
 * **Main Process**
 *
 * ```ts
 * import { withRedial } from "@laserware/redial";
 * import { configureStore } from "@reduxjs/toolkit";
 * import { ipcMain, webContents } from "electron";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * function createStore() {
 *   return withRedial(
 *     "main",
 *     {
 *       addListener: (...args) => ipcMain.addListener(...args),
 *       removeListener: (...args) => ipcMain.removeListener(...args),
 *       getAllWebContents: () => webContents.getAllWebContents(),
 *     },
 *     ({
 *       createForwardingMiddleware,
 *       replayAction,
 *       listenForStateRequests,
 *     }) => {
 *       const forwardToRendererMiddleware = createForwardingMiddleware();
 *
 *       const store = configureStore({
 *         reducer: rootReducer,
 *          middleware: (getDefaultMiddleware) =>
 *            getDefaultMiddleware().concat(forwardToRendererMiddleware),
 *       });
 *
 *       replayAction(store);
 *
 *       listenForStateRequests(store);
 *
 *       return store;
 *     },
 *   );
 * }
 * ```
 *
 * **Renderer Process**
 *
 * ```ts
 * import { withRedial } from "@laserware/redial";
 * import { configureStore } from "@reduxjs/toolkit";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * // Assuming you're not using context isolation:
 * const ipcRenderer = window.require("electron").ipcRenderer;
 *
 * function createStore() {
 *   return withRedial(
 *     "renderer",
 *     {
 *       addListener: (...args) => ipcRenderer.addListener(...args),
 *       removeListener: (...args) => ipcRenderer.removeListener(...args),
 *       send: (...args) => ipcRenderer.send(...args),
 *       sendSync: (...args) => ipcRenderer.sendSync(...args),
 *     },
 *     ({
 *       createForwardingMiddleware,
 *       replayAction,
 *       requestState,
 *     }) => {
 *       const forwardToMainMiddleware = createForwardingMiddleware();
 *
 *       // Note that this is blocking, so we only do it in development:
 *       let preloadedState;
 *
 *       if (__ENV__ === "development") {
 *         preloadedState = requestState();
 *       }
 *
 *       const store = configureStore({
 *         preloadedState,
 *         reducer: rootReducer,
 *         middleware: (getDefaultMiddleware) =>
 *           getDefaultMiddleware().concat(forwardToMainMiddleware),
 *       });
 *
 *       replayAction(store);
 *
 *       return store;
 *     },
 *   );
 * }
 * ```
 */
export function withRedial<
  PN extends ProcessName,
  S extends AnyState = AnyState,
>(
  processName: PN,
  electronApi: ElectronApiIn<PN>,
  initializer: (init: RedialInit<S, PN>) => Store<S>,
): Store<S> {
  if (processName === "main") {
    const mainApi = electronApi as ElectronMainApi;

    const options: RedialMainInit<S> = {
      createForwardingMiddleware: getCreateForwardToRendererMiddleware(mainApi),
      replayAction: getReplayActionInMain(mainApi),
      listenForStateRequests: getListenForStateRequests(mainApi),
    };

    // @ts-ignore Don't know why this is failing, but it's valid.
    return initializer(options);
  }

  if (processName === "renderer") {
    const rendererApi = electronApi as ElectronRendererApi;

    const options: RedialRendererInit<S> = {
      createForwardingMiddleware: getCreateForwardToMainMiddleware(rendererApi),
      replayAction: getReplayActionInRenderer(rendererApi),
      requestState: getRequestStateFromMain(rendererApi),
    };

    // @ts-ignore Don't know why this is failing, but it's valid.
    return initializer(options);
  }

  // prettier-ignore
  throw new Error(`Invalid process name ${processName}, only "main" or "renderer" allowed`);
}

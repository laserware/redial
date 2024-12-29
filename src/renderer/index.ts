import type { Action } from "@laserware/stasis";
import type { Middleware, Store } from "@reduxjs/toolkit";
import type { IpcRenderer, IpcRendererEvent } from "electron";

import {
  getRedialActionMeta,
  isRedialAction,
  toRedialAction,
} from "../common/action.js";
import {
  IpcChannel,
  type AnyState,
  type CreateForwardingMiddlewareFunction,
  type ForwardToMiddlewareOptions,
  type RedialAction,
} from "../common/types.js";

/**
 * Object available as the argument in the {@linkcode redialRenderer} initializer
 * function in the renderer process.
 *
 * @template S Type definition for Redux state.
 */
export type RedialRendererInit<S> = {
  /**
   * Creates the forwarding middleware that forwards dispatched actions to the
   * main process.
   */
  createForwardingMiddleware: CreateForwardingMiddlewareFunction;

  /**
   * Synchronously request state from the main process.
   *
   * **Important Note**
   *
   * This will block the main thread until the state is returned from the
   * main process. You should only use this in development to keep state
   * synchronized between reloads of the renderer process.
   */
  requestState: () => S | undefined;
};

/**
 * IPC API needed for the renderer process.
 */
export type IpcApi = Pick<
  IpcRenderer,
  "addListener" | "removeListener" | "sendSync" | "send"
>;

/**
 * Creates a Redux store that contains middleware for communicating with the
 * main process and keeping state in sync. Any actions dispatched from
 * the renderer process are automatically forwarded to the main
 * process.
 *
 * Note that you _must_ return the Redux store from the `initializer` callback.
 *
 * @template S Type definition for Redux state.
 *
 * @param ipcApi Electron IPC API for the renderer process.
 * @param initializer Callback with Electron IPC middleware APIs as the `init` argument.
 *
 * @example
 * import { redialRenderer } from "@laserware/redial/renderer";
 * import { configureStore } from "@reduxjs/toolkit";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * // Assuming you're not using context isolation:
 * const ipcRenderer = window.require("electron").ipcRenderer;
 *
 * function createStore(onCleanup) {
 *   const store = redialRenderer(
 *     window.require("electron").ipcRenderer,
 *     ({
 *       createForwardingMiddleware,
 *       requestState,
 *     }) => {
 *       const forwardToMainMiddleware = createForwardingMiddleware();
 *
 *       // Note that this is blocking, so we only do it in development:
 *       let preloadedState;
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
 *       return store;
 *     },
 *   );
 *
 *   return store;
 * }
 */
export function redialRenderer<S extends AnyState = AnyState>(
  ipcApi: IpcApi,
  initializer: (init: RedialRendererInit<S>) => Store<S>,
): Store<S> {
  const requestState = <S>(): S | undefined =>
    ipcApi.sendSync(IpcChannel.ForStateSync);

  const init: RedialRendererInit<S> = {
    createForwardingMiddleware: getForwardingMiddlewareCreator(ipcApi),
    requestState,
  };

  const store = initializer(init);

  const replayAction = (event: IpcRendererEvent, action: Action): void => {
    store.dispatch(action);
  };

  ipcApi.removeListener(IpcChannel.FromMain, replayAction);
  ipcApi.addListener(IpcChannel.FromMain, replayAction);

  return store;
}

/**
 * Whenever an action is fired from the renderer process, forward it to the
 * main process to ensure global state is in sync.
 *
 * @internal
 */
function getForwardingMiddlewareCreator(ipcApi: IpcApi) {
  // Used as a fallback for undefined hooks.
  const noop = <A = any>(action: A): A => action;

  return function createForwardToMainMiddleware(
    hooks?: ForwardToMiddlewareOptions,
  ): Middleware {
    const beforeSend = hooks?.beforeSend ?? noop;
    const afterSend = hooks?.afterSend ?? noop;

    return () => (next) => (action) => {
      let redialAction: RedialAction;

      if (isRedialAction(action)) {
        redialAction = action;
      } else {
        redialAction = toRedialAction(action);
      }

      if (redialAction.type?.startsWith("@@")) {
        return next(redialAction);
      }

      const redialMeta = getRedialActionMeta(redialAction);

      if (redialMeta.forwarded || redialMeta.source === "renderer") {
        return next(redialAction);
      }

      redialAction = beforeSend(redialAction);

      redialAction.meta.redial.forwarded = true;
      redialAction.meta.redial.source = "renderer";

      ipcApi.send(IpcChannel.FromRenderer, redialAction);

      // No reason to reassign `redialAction` here as this is the end of the
      // line. But it could be useful for logging or introspection:
      afterSend(redialAction);

      return next(redialAction);
    };
  };
}

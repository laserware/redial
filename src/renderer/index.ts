import type { Middleware, Store } from "@laserware/stasis";
import type { IpcRenderer } from "electron";

import { replayActionInProcess } from "../common/replay.js";
import {
  IpcChannel,
  type AnyState,
  type CreateForwardingMiddlewareFunction,
  type ForwardedAction,
  type ForwardToMiddlewareOptions,
} from "../common/types.js";

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
 * IPC API needed for the <i>renderer</i> process.
 */
export type IpcApi = Pick<
  IpcRenderer,
  "addListener" | "removeListener" | "send" | "sendSync"
>;

/**
 * Creates a Redux store that contains middleware for communicating with the
 * <i>main</i> process and keeping state in sync. Any actions dispatched from
 * the <i>renderer</i> process are automatically forwarded to the <i>main</i>
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
 * import { withRedialRenderer } from "@laserware/redial/renderer";
 * import { configureStore } from "@reduxjs/toolkit";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * // Assuming you're not using context isolation:
 * const ipcRenderer = window.require("electron").ipcRenderer;
 *
 * function createStore() {
 *   return withRedialRenderer(
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
 */
export function withRedialRenderer<S extends AnyState = AnyState>(
  ipcApi: IpcApi,
  initializer: (init: RedialRendererInit<S>) => Store<S>,
): Store<S> {
  const replayAction = <S>(store: Store<S>): void => {
    replayActionInProcess(ipcApi, store);
  };

  const requestState = <S>(): S | undefined => {
    return ipcApi.sendSync(IpcChannel.ForStateSync);
  };

  const init: RedialRendererInit<S> = {
    createForwardingMiddleware: getForwardingMiddlewareCreator(ipcApi),
    replayAction,
    requestState,
  };

  return initializer(init);
}

/**
 * Whenever an action is fired from the <i>renderer</i> process, forward it to the
 * <i>main</i> process to ensure global state is in sync.
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
      let forwardedAction = action as ForwardedAction;

      // @ts-ignore
      if (forwardedAction.type?.startsWith("@@")) {
        return next(action);
      }

      const wasAlreadyForwarded =
        forwardedAction.meta?.wasAlreadyForwarded ?? false;

      const shouldBeForwarded = !wasAlreadyForwarded;

      if (shouldBeForwarded) {
        forwardedAction = beforeSend(forwardedAction);

        ipcApi.send(IpcChannel.ForMiddleware, forwardedAction);

        // No reason to reassign `forwardedAction` here as this is the end of the
        // line. But it could be useful for logging or introspection:
        afterSend(forwardedAction);

        return undefined;
      }

      return next(action);
    };
  };
}

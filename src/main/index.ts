import type { Middleware, Store } from "@laserware/stasis";
import { ipcMain, webContents, type IpcMainEvent } from "electron";

import { replayActionInProcess } from "../common/replay.js";
import {
  IpcChannel,
  type AnyState,
  type CreateForwardingMiddlewareFunction,
  type ForwardedAction,
  type ForwardToMiddlewareOptions,
} from "../common/types.js";

/**
 * Object available as the argument in the {@linkcode withRedialMain} initializer
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
 * Creates a Redux store that contains middleware for communicating with the
 * <i>renderer</i> process and keeping state in sync. Any actions dispatched from
 * the <i>main</i> process are automatically forwarded to the <i>renderer</i>
 * process.
 *
 * Note that you _must_ return the Redux store from the `initializer` callback.
 *
 * @template S Type definition for Redux state.
 *
 * @param initializer Callback with Electron IPC middleware APIs as the `init` argument.
 *
 * @example
 * import { withRedialMain } from "@laserware/redial/main";
 * import { configureStore } from "@reduxjs/toolkit";
 * import { ipcMain, webContents } from "electron";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * function createStore() {
 *   return withRedialMain(
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
 */
export function withRedialMain<S extends AnyState = AnyState>(
  initializer: (init: RedialMainInit<S>) => Store<S>,
): Store<S> {
  const replayAction = <S>(store: Store<S>): void => {
    replayActionInProcess(ipcMain, store);
  };

  const listenForStateRequests = async <S>(store: Store<S>): Promise<void> => {
    const handleGetStateChannel = (event: IpcMainEvent): void => {
      event.returnValue = store.getState();
    };

    try {
      ipcMain.removeListener(IpcChannel.ForStateSync, handleGetStateChannel);
    } catch {
      // Do nothing.
    }

    ipcMain.addListener(IpcChannel.ForStateSync, handleGetStateChannel);
  };

  const init: RedialMainInit<S> = {
    createForwardingMiddleware: getForwardingMiddlewareCreator(),
    replayAction,
    listenForStateRequests,
  };

  return initializer(init);
}

/**
 * Whenever an action is fired from the <i>main</i> process, forward it to the
 * <i>renderer</i> process to ensure global state is in sync.
 *
 * @internal
 */
export function getForwardingMiddlewareCreator() {
  // Used as a fallback for undefined hooks.
  const noop = <A = any>(action: A): A => action;

  return (options?: ForwardToMiddlewareOptions): Middleware => {
    const beforeSend = options?.beforeSend ?? noop;
    const afterSend = options?.afterSend ?? noop;

    return () => (next) => (action) => {
      let forwardedAction = action as ForwardedAction;

      if (forwardedAction.meta?.wasAlreadyForwarded ?? false) {
        return next(action);
      }

      const existingMeta = forwardedAction.meta ?? {};

      // Add the `wasAlreadyForwarded` boolean to the action `meta` property.
      // We append it to the existing `meta` (if already present):
      forwardedAction.meta = {
        ...existingMeta,
        wasAlreadyForwarded: true,
      };

      // We send a message to all BrowserWindow instances to ensure they can
      // react to state updates.
      const allWebContents = webContents.getAllWebContents();
      for (const contentWindow of allWebContents) {
        forwardedAction = beforeSend(forwardedAction);

        contentWindow.send(IpcChannel.ForMiddleware, forwardedAction);

        forwardedAction = afterSend(forwardedAction);
      }

      return next(action);
    };
  };
}

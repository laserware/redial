import type { Action } from "@laserware/stasis";
import type { Middleware, Store } from "@reduxjs/toolkit";
import { ipcMain, webContents, type IpcMainEvent } from "electron";

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

export type { AnyState, RedialReturn } from "../common/types.js";

/**
 * Object available as the argument in the {@linkcode redialMain} initializer
 * function in the <i>main</i> process.
 */
export type RedialMainInit = {
  /**
   * Creates the forwarding middleware that forwards dispatched actions to the
   * <i>renderer</i> process.
   */
  createForwardingMiddleware: CreateForwardingMiddlewareFunction;
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
 * import { redialMain } from "@laserware/redial/main";
 * import { configureStore } from "@reduxjs/toolkit";
 * import { ipcMain, webContents } from "electron";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * function createStore() {
 *   const store = redialMain(
 *     ({ createForwardingMiddleware }) => {
 *       const forwardToRendererMiddleware = createForwardingMiddleware();
 *
 *       const store = configureStore({
 *         reducer: rootReducer,
 *          middleware: (getDefaultMiddleware) =>
 *            getDefaultMiddleware().concat(forwardToRendererMiddleware),
 *       });
 *
 *       listenForStateRequests(store);
 *
 *       return store;
 *     },
 *   );
 *
 *   return store;
 * }
 */
export function redialMain<S extends AnyState = AnyState>(
  initializer: (init: RedialMainInit) => Store<S>,
): Store<S> {
  const init: RedialMainInit = {
    createForwardingMiddleware: getForwardingMiddlewareCreator(),
  };

  const store = initializer(init);

  listenForStateRequests(store);

  const replayAction = (event: IpcMainEvent, action: Action): void => {
    store.dispatch(action);
  };

  ipcMain
    .removeListener(IpcChannel.FromRenderer, replayAction)
    .addListener(IpcChannel.FromRenderer, replayAction);

  return store;
}

function listenForStateRequests<S>(store: Store<S>): void {
  const handleGetStateChannel = (event: IpcMainEvent): void => {
    event.returnValue = store.getState();
  };

  ipcMain
    .removeListener(IpcChannel.ForStateSync, handleGetStateChannel)
    .addListener(IpcChannel.ForStateSync, handleGetStateChannel);
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
      let redialAction: RedialAction;

      if (isRedialAction(action)) {
        redialAction = action;
      } else {
        redialAction = toRedialAction(action);
      }

      const redialMeta = getRedialActionMeta(redialAction);

      if (redialMeta.forwarded || redialMeta.source === "main") {
        return next(redialAction);
      }

      redialAction.meta.redial.forwarded = true;
      redialAction.meta.redial.source = "main";

      // We send a message to all BrowserWindow instances to ensure they can
      // react to state updates.
      const allWebContents = webContents.getAllWebContents();
      for (const contentWindow of allWebContents) {
        redialAction = beforeSend(redialAction);

        contentWindow.send(IpcChannel.FromMain, redialAction);

        afterSend(redialAction);
      }

      return next(redialAction);
    };
  };
}
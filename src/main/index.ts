import type { Action } from "@laserware/stasis";
import type { Middleware, Store } from "@reduxjs/toolkit";
import { ipcMain, webContents, type IpcMainEvent } from "electron";

import {
  isActionLike,
  toRedialAction,
  wasActionAlreadyForwarded,
} from "../common/action.js";
import { isStore } from "../common/isStore.js";
import {
  IpcChannel,
  type AnyState,
  type CreateForwardingMiddlewareFunction,
  type ForwardToMiddlewareOptions,
} from "../common/types.js";

/**
 * Object available as the argument in the {@linkcode redialMain} initializer
 * function in the main process.
 */
export type RedialMainInit = {
  /**
   * Creates the forwarding middleware that forwards dispatched actions to the
   * renderer process.
   */
  createForwardingMiddleware: CreateForwardingMiddlewareFunction;
};

/**
 * Creates a Redux store that contains middleware for communicating with the
 * renderer process and keeping state in sync. Any actions dispatched from
 * the main process are automatically forwarded to the renderer
 * process.
 *
 * > [!IMPORTANT]
 * > You **must** return the Redux store from the `initializer` callback.
 * >
 * > If you need to perform any additional operations after the store is created,
 * > you should use the return value of `redialMain`, rather than the return
 * > value of `configureStore`. Limit the contents of the `initializer` callback
 * > to store configuration code only. If you try putting
 *
 * @template S Type definition for Redux state.
 *
 * @param initializer Callback with Electron IPC middleware APIs as the `init` argument (must return a Redux store).
 *
 * @throws {Error} If the store isn't returned from the `initializer` callback.
 *
 * @example
 * **Simple Configuration**
 *
 * ```ts
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
 *       return configureStore({
 *         reducer: rootReducer,
 *          middleware: (getDefaultMiddleware) =>
 *            getDefaultMiddleware().concat(forwardToRendererMiddleware),
 *       });
 *     },
 *   );
 *
 *   return store;
 * }
 * ```
 *
 * **Advanced Configuration**
 *
 * ```ts
 * import { redialMain } from "@laserware/redial/main";
 * import { configureStore } from "@reduxjs/toolkit";
 * import { ipcMain, webContents } from "electron";
 * import createSagaMiddleware from "redux-saga";
 *
 * import { rootReducer } from "./rootReducer";
 * import { mainSagas } from "./sagas";
 *
 * function createStore() {
 *   // Initializing this in outer scope so we can call `.run` after the store
 *   // is created:
 *   const sagaMiddleware = createSagaMiddleware();
 *
 *   const store = redialMain(
 *     ({ createForwardingMiddleware }) => {
 *       const forwardToRendererMiddleware = createForwardingMiddleware();
 *
 *       return configureStore({
 *         reducer: rootReducer,
 *          middleware: (getDefaultMiddleware) =>
 *            // Note that the order matters. The forwarding middleware will
 *            // forward any actions dispatched by your side effects library.
 *            // If you swap the order, any actions dispatched from a saga won't
 *            // make it to the renderer process:
 *            getDefaultMiddleware().concat(sagaMiddleware, forwardToRendererMiddleware),
 *       });
 *     },
 *   );
 *
 *   // Call `.run` _after_ configuring the store to ensure forwarding is working
 *   // before executing any sagas:
 *   sagaMiddleware.run(mainSagas);
 *
 *   return store;
 * }
 * ```
 */
export function redialMain<S extends AnyState = AnyState>(
  initializer: (init: RedialMainInit) => Store<S>,
): Store<S> {
  const replayActions = (store: Store<S>): void => {
    const handleAction = (event: IpcMainEvent, action: Action): void => {
      store.dispatch(action);
    };

    ipcMain
      .removeListener(IpcChannel.FromRenderer, handleAction)
      .addListener(IpcChannel.FromRenderer, handleAction);
  };

  const listenForStateRequests = (store: Store<S>): void => {
    const handleGetStateChannel = (event: IpcMainEvent): void => {
      event.returnValue = store.getState();
    };

    ipcMain
      .removeListener(IpcChannel.ForStateSync, handleGetStateChannel)
      .addListener(IpcChannel.ForStateSync, handleGetStateChannel);
  };

  const init: RedialMainInit = {
    createForwardingMiddleware: getForwardingMiddlewareCreator(),
  };

  const store = initializer(init);

  if (!isStore(store)) {
    // prettier-ignore
    throw new Error("The value returned from the redial initializer callback is not a Redux store");
  }

  replayActions(store);

  listenForStateRequests(store);

  return store;
}

/**
 * Whenever an action is fired from the main process, forward it to the
 * renderer process to ensure global state is in sync.
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
      if (!isActionLike(action)) {
        return next(action);
      }

      let redialAction = toRedialAction(action);

      if (wasActionAlreadyForwarded(redialAction, "main")) {
        return next(redialAction);
      }

      redialAction.meta.redial.forwarded = true;
      redialAction.meta.redial.source = "main";

      // We send a message to all BrowserWindow instances to ensure they can
      // react to state updates.
      const allWebContents = webContents.getAllWebContents();
      for (const contentWindow of allWebContents) {
        redialAction = beforeSend(redialAction);

        redialAction.meta.redial.frameId = contentWindow.id;

        contentWindow.send(IpcChannel.FromMain, redialAction);

        redialAction = afterSend(redialAction);
      }

      return next(redialAction);
    };
  };
}

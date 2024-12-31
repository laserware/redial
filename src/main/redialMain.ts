import type { Action } from "@laserware/stasis";
import type { Store } from "@reduxjs/toolkit";
import { ipcMain, type IpcMainEvent } from "electron";

import { isStore } from "../common/guards.js";
import {
  IpcChannel,
  type AnyState,
  type CreateForwardingMiddlewareFunction,
} from "../common/types.js";

import { getForwardToRendererMiddlewareCreator } from "./middleware.js";

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

    ipcMain.removeListener(IpcChannel.FromRenderer, handleAction);
    ipcMain.addListener(IpcChannel.FromRenderer, handleAction);
  };

  const listenForStateRequests = (store: Store<S>): void => {
    const handleGetStateChannel = (event: IpcMainEvent): void => {
      event.returnValue = store.getState();
    };

    ipcMain.removeListener(IpcChannel.ForStateSync, handleGetStateChannel);
    ipcMain.addListener(IpcChannel.ForStateSync, handleGetStateChannel);
  };

  const init: RedialMainInit = {
    createForwardingMiddleware: getForwardToRendererMiddlewareCreator(),
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

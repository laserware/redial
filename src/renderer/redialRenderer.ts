import type { Action } from "@laserware/stasis";
import type { Store } from "@reduxjs/toolkit";
import type { IpcRendererEvent } from "electron";

import { isStore } from "../common/guards.js";
import {
  IpcChannel,
  type AnyState,
  type CreateForwardingMiddlewareFunction,
} from "../common/types.js";

import {
  getForwardToMainMiddlewareCreator,
  type IpcRendererMethods,
} from "./middleware.js";

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
   * > [!CAUTION]
   * > This will block the main thread until the state is returned from the
   * > main process. You should only use this in development to keep state
   * > synchronized between reloads of the renderer process.
   *
   * @example
   * function createStore() {
   *   const ipcRenderer = window.require("electron").ipcRenderer;
   *
   *   const store = redialRenderer(
   *     ipcRenderer,
   *     ({ createForwardingMiddleware, requestState }) => {
   *       // ...
   *
   *       // The `preloadedState` entry can be `undefined`, so no need to
   *       // initialize a value here:
   *       let preloadedState;
   *
   *       // Vite exposes the `MODE` environment variable to determine if
   *       // running in development or production:
   *       if (import.meta.env.MODE === "development") {
   *         preloadedState = requestState();
   *       }
   *
   *       return configureStore({
   *         preloadedState,
   *         // ...
   *       });
   *     },
   *   );
   * }
   */
  requestState: () => S | undefined;
};

/**
 * Creates a Redux store that contains middleware for communicating with the
 * main process and keeping state in sync. Any actions dispatched from
 * the renderer process are automatically forwarded to the main
 * process.
 *
 * > [!IMPORTANT]
 * > You **must** return the Redux store from the `initializer` callback.
 *
 * @template S Type definition for Redux state.
 *
 * @param ipcRenderer Electron IPC API for the renderer process. This is required because the APIs may only
 *                    be accessible via a custom global object exposed via [contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge).
 * @param initializer Callback with Electron IPC middleware APIs as the `init` argument (must return a Redux store).
 *
 * @throws {Error} If the store isn't returned from the `initializer` callback.
 *
 * @example
 * **Simple Configuration**
 *
 * ```ts
 * import { redialRenderer } from "@laserware/redial/renderer";
 * import { configureStore } from "@reduxjs/toolkit";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * // Assuming you're not using context isolation:
 * const ipcRenderer = window.require("electron").ipcRenderer;
 *
 * function createStore() {
 *   const store = redialRenderer(
 *     ipcRenderer,
 *     ({ createForwardingMiddleware, requestState }) => {
 *       const forwardToMainMiddleware = createForwardingMiddleware();
 *
 *       // Note that this is blocking, so we only do it in development:
 *       let preloadedState;
 *       if (__ENV__ === "development") {
 *         preloadedState = requestState();
 *       }
 *
 *       return configureStore({
 *         preloadedState,
 *         reducer: rootReducer,
 *         middleware: (getDefaultMiddleware) =>
 *           getDefaultMiddleware().concat(forwardToMainMiddleware),
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
 * import { redialRenderer } from "@laserware/redial/renderer";
 * import { configureStore } from "@reduxjs/toolkit";
 * import createSagaMiddleware from "redux-saga";
 *
 * import { rootReducer } from "./rootReducer";
 * import { rendererSagas } from "./sagas";
 *
 * // Assuming you're not using context isolation:
 * const ipcRenderer = window.require("electron").ipcRenderer;
 *
 * function createStore() {
 *   // Initializing this in outer scope so we can call `.run` after the store
 *   // is created:
 *   const sagaMiddleware = createSagaMiddleware();
 *
 *   const store = redialRenderer(
 *     ipcRenderer,
 *     ({ createForwardingMiddleware, requestState }) => {
 *       const forwardToMainMiddleware = createForwardingMiddleware();
 *
 *       // ... State request code (see previous example) ...
 *
 *       return configureStore({
 *         reducer: rootReducer,
 *          middleware: (getDefaultMiddleware) =>
 *            // Note that the order matters. The forwarding middleware will
 *            // forward any actions dispatched by your side effects library.
 *            // If you swap the order, any actions dispatched from a saga won't
 *            // make it to the main process:
 *            getDefaultMiddleware().concat(sagaMiddleware, forwardToMainMiddleware),
 *       });
 *     },
 *   );
 *
 *   // Call `.run` _after_ configuring the store to ensure forwarding is working
 *   // before executing any sagas:
 *   sagaMiddleware.run(rendererSagas);
 *
 *   return store;
 * }
 * ```
 */
export function redialRenderer<S extends AnyState = AnyState>(
  ipcRenderer: IpcRendererMethods,
  initializer: (init: RedialRendererInit<S>) => Store<S>,
): Store<S> {
  const replayActions = (store: Store<S>): void => {
    const handleAction = (event: IpcRendererEvent, action: Action): void => {
      store.dispatch(action);
    };

    ipcRenderer.removeListener(IpcChannel.FromMain, handleAction);
    ipcRenderer.addListener(IpcChannel.FromMain, handleAction);
  };

  const requestState = (): S | undefined =>
    ipcRenderer.sendSync(IpcChannel.ForStateSync);

  const init: RedialRendererInit<S> = {
    createForwardingMiddleware: getForwardToMainMiddlewareCreator(ipcRenderer),
    requestState,
  };

  const store = initializer(init);

  if (!isStore(store)) {
    // prettier-ignore
    throw new Error("The value returned from the redial initializer callback is not a Redux store");
  }

  replayActions(store);

  return store;
}

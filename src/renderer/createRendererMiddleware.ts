import type { Action, Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import type { IpcRenderer, IpcRendererEvent } from "electron";

import { getMiddlewareForwarder } from "../internal.js";
import {
  IpcChannel,
  type AnyState,
  type IDisposable,
  type RedialMiddlewareHooks,
} from "../types.js";

/**
 * Methods needed from the [ipcRenderer](https://www.electronjs.org/docs/latest/api/ipc-renderer)
 * API to listen for and send events to the main process.
 */
export type IpcRendererMethods = Pick<
  IpcRenderer,
  "addListener" | "removeListener" | "sendSync" | "send" | "invoke"
>;

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
 * argument allows you to make changes to the action prior to forwarding and
 * after forwarding before passing the action to the next middlewares.
 *
 * @param ipcRenderer Required methods from [ipcRenderer](https://www.electronjs.org/docs/latest/api/ipc-renderer).
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
 * // Assuming no context isolation:
 * const ipcRenderer = window.require("electron").ipcRenderer;
 *
 * export function createStore(): Store {
 *   const redialMiddleware = createRedialRendererMiddleware();
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
  ipcRenderer: IpcRendererMethods,
  hooks?: RedialMiddlewareHooks,
): RedialRendererMiddleware {
  const forwarder = getMiddlewareForwarder(hooks);

  let disposable: IDisposable | null = null;

  const middleware = (api: MiddlewareAPI) => {
    if (disposable === null) {
      disposable = handleForwardedAction(ipcRenderer, api);
    }

    // Forward actions to the main process:
    return (next) => (action) => {
      return forwarder(next, action, (redialAction) => {
        ipcRenderer.send(IpcChannel.FromRenderer, redialAction);
      });
    };
  };

  const dispose = (): void => {
    disposable?.dispose();
  };

  const getMainState = async <S extends AnyState = AnyState>(): Promise<S> => {
    return await ipcRenderer.invoke(IpcChannel.ForStateAsync);
  };

  const getMainStateSync = <S extends AnyState = AnyState>(): S => {
    return ipcRenderer.sendSync(IpcChannel.ForStateSync);
  };

  return Object.assign(middleware, {
    dispose,
    getMainState,
    getMainStateSync,
  });
}

function handleForwardedAction(
  ipcRenderer: IpcRendererMethods,
  api: MiddlewareAPI,
): IDisposable {
  const handleAction = (event: IpcRendererEvent, action: Action): void => {
    api.dispatch(action);
  };

  ipcRenderer.addListener(IpcChannel.FromMain, handleAction);

  return {
    dispose() {
      ipcRenderer.removeListener(IpcChannel.FromMain, handleAction);
    },
  };
}

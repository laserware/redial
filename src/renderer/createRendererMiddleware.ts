import type { Action, MiddlewareAPI } from "@reduxjs/toolkit";
import type { IpcRendererEvent } from "electron";

import {
  IpcChannel,
  type AnyAction,
  type IDisposable,
  type IpcRendererMethods,
  type RedialMiddleware,
  type RedialMiddlewareOptions,
} from "../common/types.js";

/**
 * Whenever an action is fired from the renderer process, forward it to the
 * main process to ensure global state is in sync.
 */
export function createRedialRendererMiddleware(
  ipcRenderer: IpcRendererMethods,
  options?: RedialMiddlewareOptions,
): RedialMiddleware {
  // Used as a fallback for undefined hooks.
  const noop = <A = any>(action: A): A => action;

  const beforeSend = options?.beforeSend ?? noop;
  const afterSend = options?.afterSend ?? noop;

  let disposable: IDisposable | null = null;

  const middleware = (api: MiddlewareAPI) => {
    if (disposable === null) {
      disposable = handleForwardedAction(ipcRenderer, api);
    }

    /**
     * Forwards actions to the main process.
     */
    return (next) => (action) => {
      if (action?.type === undefined) {
        return next(action);
      }

      if (action.type.startsWith("@@")) {
        return next(action);
      }

      if (action.meta?.redial?.forwarded) {
        return next(action);
      }

      action.meta = { ...action.meta, redial: { forwarded: true } };

      action = beforeSend(action);

      ipcRenderer.send(IpcChannel.FromRenderer, action);

      afterSend(action as AnyAction);

      return next(action);
    };
  };

  return Object.assign(middleware, {
    dispose() {
      disposable?.dispose();
    },
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

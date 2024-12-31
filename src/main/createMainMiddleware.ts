import type { Action, MiddlewareAPI } from "@reduxjs/toolkit";
import { ipcMain, webContents, type IpcMainEvent } from "electron";

import {
  IpcChannel,
  type AnyAction,
  type IDisposable,
  type RedialMiddleware,
  type RedialMiddlewareOptions,
} from "../common/types.js";

type HandlerName = "forwardAction" | "asyncStateRequest" | "syncStateRequest";

/**
 * Whenever an action is fired from the main process, forward it to the
 * renderer process to ensure global state is in sync.
 */
export function createRedialMainMiddleware(
  options?: RedialMiddlewareOptions,
): RedialMiddleware {
  // Used as a fallback for undefined hooks.
  const noop = <A = any>(action: A): A => action;

  const beforeSend = options?.beforeSend ?? noop;
  const afterSend = options?.afterSend ?? noop;

  const disposables = new Map<HandlerName, IDisposable | undefined>([
    ["forwardAction", undefined],
    ["asyncStateRequest", undefined],
    ["syncStateRequest", undefined],
  ]);

  const middleware = (api: MiddlewareAPI) => {
    if (disposables.get("forwardAction") === undefined) {
      disposables.set("forwardAction", handleForwardedAction(api));
    }

    if (disposables.get("asyncStateRequest") === undefined) {
      disposables.set("asyncStateRequest", handleAsyncStateRequests(api));
    }

    if (disposables.get("syncStateRequest") === undefined) {
      disposables.set("syncStateRequest", handleSyncStateRequests(api));
    }

    return (next) => (action) => {
      if (action?.type === undefined) {
        return next(action);
      }

      if (action.meta?.redial?.forwarded) {
        return next(action);
      }

      action.meta = { ...action.meta, redial: { forwarded: true } };

      for (const contentWindow of webContents.getAllWebContents()) {
        action = beforeSend(action as AnyAction);

        contentWindow.send(IpcChannel.FromMain, action);

        action = afterSend(action as AnyAction);
      }

      return next(action);
    };
  };

  return Object.assign(middleware, {
    dispose() {
      for (const disposable of disposables.values()) {
        disposable?.dispose();
      }
    },
  });
}

function handleForwardedAction(api: MiddlewareAPI): IDisposable {
  const handleAction = (event: IpcMainEvent, action: Action): void => {
    api.dispatch(action);
  };

  ipcMain.addListener(IpcChannel.FromRenderer, handleAction);

  return {
    dispose() {
      ipcMain.removeListener(IpcChannel.FromRenderer, handleAction);
    },
  };
}

function handleAsyncStateRequests(api: MiddlewareAPI): IDisposable {
  const handleAsyncRequest = (): void => {
    return api.getState();
  };

  ipcMain.handle(IpcChannel.ForStateAsync, handleAsyncRequest);

  return {
    dispose() {
      ipcMain.removeHandler(IpcChannel.ForStateAsync);
    },
  };
}

function handleSyncStateRequests(api: MiddlewareAPI): IDisposable {
  const handleSyncRequest = (event: IpcMainEvent): void => {
    event.returnValue = api.getState();
  };

  ipcMain.addListener(IpcChannel.ForStateSync, handleSyncRequest);

  return {
    dispose() {
      ipcMain.removeListener(IpcChannel.ForStateSync, handleSyncRequest);
    },
  };
}

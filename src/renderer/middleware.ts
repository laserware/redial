import type { Middleware } from "@reduxjs/toolkit";
import type { IpcRenderer } from "electron";

import { isAction } from "../common/guards.js";
import {
  IpcChannel,
  type AnyAction,
  type RedialMiddlewareOptions,
} from "../common/types.js";

/**
 * Methods needed from the [ipcRenderer](https://www.electronjs.org/docs/latest/api/ipc-renderer)
 * API to listen for and send events to the main process.
 *
 * @public
 */
export type IpcRendererMethods = Pick<
  IpcRenderer,
  "addListener" | "removeListener" | "sendSync" | "send"
>;

/**
 * Whenever an action is fired from the renderer process, forward it to the
 * main process to ensure global state is in sync.
 *
 * @internal
 */
export function getForwardToMainMiddlewareCreator(
  ipcRenderer: IpcRendererMethods,
) {
  // Used as a fallback for undefined hooks.
  const noop = <A = any>(action: A): A => action;

  return function createForwardToMainMiddleware(
    hooks?: RedialMiddlewareOptions,
  ): Middleware {
    const beforeSend = hooks?.beforeSend ?? noop;
    const afterSend = hooks?.afterSend ?? noop;

    return (api) => {
      console.log(api);
      return (next) => (action) => {
        if (!isAction(action)) {
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
  };
}

import type { Middleware } from "@reduxjs/toolkit";
import type { IpcRenderer } from "electron";

import {
  isActionLike,
  toRedialAction,
  wasActionAlreadyForwarded,
} from "../common/action.js";
import {
  IpcChannel,
  type ForwardToMiddlewareOptions,
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
    hooks?: ForwardToMiddlewareOptions,
  ): Middleware {
    const beforeSend = hooks?.beforeSend ?? noop;
    const afterSend = hooks?.afterSend ?? noop;

    return () => (next) => (action) => {
      if (!isActionLike(action)) {
        return next(action);
      }

      if (action.type?.startsWith("@@")) {
        return next(action);
      }

      let redialAction = toRedialAction(action);

      if (wasActionAlreadyForwarded(redialAction, "renderer")) {
        return next(redialAction);
      }

      redialAction = beforeSend(redialAction);

      redialAction.meta.redial.forwarded = true;
      redialAction.meta.redial.source = "renderer";

      ipcRenderer.send(IpcChannel.FromRenderer, redialAction);

      redialAction = afterSend(redialAction);

      return next(redialAction);
    };
  };
}

import type { Middleware } from "@reduxjs/toolkit";
import { webContents } from "electron";

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
 * Whenever an action is fired from the main process, forward it to the
 * renderer process to ensure global state is in sync.
 *
 * @internal
 */
export function getForwardToRendererMiddlewareCreator() {
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

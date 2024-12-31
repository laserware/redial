import type { Middleware } from "@reduxjs/toolkit";
import { webContents } from "electron";

import { isAction } from "../common/guards.js";
import {
  IpcChannel,
  type AnyAction,
  type RedialMiddlewareOptions,
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

  return (options?: RedialMiddlewareOptions): Middleware => {
    const beforeSend = options?.beforeSend ?? noop;
    const afterSend = options?.afterSend ?? noop;

    return () => (next) => (action) => {
      if (!isAction(action)) {
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
}

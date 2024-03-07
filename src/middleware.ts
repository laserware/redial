import type { Middleware, Action } from "@laserware/stasis";

import { getIpcRenderer, IpcChannel } from "./common";

interface ForwardedAction extends Action {
  meta?: { wasAlreadyForwarded: boolean };
}

export type ForwardToMiddlewareFunction = () => Middleware;

/**
 * Whenever an action is fired from the main process, forward it to the
 * renderer process to ensure global state is in sync.
 */
export function createForwardToRendererMiddleware(): Middleware {
  const { webContents } = require("electron");

  return () => (next) => (action) => {
    if (!isValidAction(action)) {
      return next(action);
    }

    const forwardedAction = action as ForwardedAction;

    if (wasActionAlreadyForwarded(forwardedAction)) {
      return next(action);
    }

    const existingMeta = forwardedAction.meta ?? {};

    // Add the `wasAlreadyForwarded` boolean to the action `meta` property.
    // We append it to the existing `meta` (if already present):
    forwardedAction.meta = {
      ...existingMeta,
      wasAlreadyForwarded: true,
    };

    // We send a message to all BrowserWindow instances to ensure they can
    // react to state updates.
    const allWebContents = webContents.getAllWebContents();
    for (const contentWindow of allWebContents) {
      contentWindow.send(IpcChannel.ForMiddleware, forwardedAction);
    }

    return next(action);
  };
}

/**
 * Whenever an action is fired from the renderer process, forward it to the
 * main process to ensure global state is in sync.
 */
export function createForwardToMainMiddleware(): Middleware {
  const ipcRenderer = getIpcRenderer();

  return () => (next) => (action) => {
    if (!isValidAction(action)) {
      return next(action);
    }

    const forwardedAction = action as ForwardedAction;

    const wasAlreadyForwarded = wasActionAlreadyForwarded(forwardedAction);
    if (wasAlreadyForwarded) {
      return next(action);
    }

    // Actions with a double `@@` prefix usually indicate that it's
    // coming from (another) third-party:
    if (/^@@/.test(forwardedAction.type)) {
      return next(action);
    }

    ipcRenderer.send(IpcChannel.ForMiddleware, forwardedAction);
  };
}

function wasActionAlreadyForwarded(action: unknown): boolean {
  const forwardedAction = action as ForwardedAction;

  // If the action was already forwarded, don't send an IPC message. If we
  // _don't_ do this, we get stuck in an infinite game of ping-pong.
  return forwardedAction.meta?.wasAlreadyForwarded ?? false;
}

/**
 * Returns true if the specified action (from middleware) is actually a valid
 * action.
 */
function isValidAction(action: unknown): boolean {
  if (typeof action !== "object" || action === null) {
    return false;
  }

  if (Array.isArray(action)) {
    return false;
  }

  return "type" in action;
}

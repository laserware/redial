import type { Middleware, Action } from "@laserware/stasis";

import { getIpcRenderer, IpcChannel } from "./common";

interface ForwardedAction extends Action {
  meta?: { wasAlreadyForwarded: boolean };
}

/**
 * Function that returns the forwarding middleware.
 */
export type CreateForwardingMiddlewareFunction = (
  // Calling this "options" instead of "hooks" in case we need to add anything
  // else here.
  options?: ForwardToMiddlewareOptions,
) => Middleware;

/**
 * Hooks that run before and after the action is sent to the other process.
 * This is useful for doing things like ensuring the payload is serialized
 * prior to sending the action, or making a change to the action after it's
 * sent to the renderer process.
 *
 * Note that the afterSend hook has no effect after sending the action to the main
 * process, as `next` isn't called, but it could be useful for logging purposes.
 *
 * @property [beforeSend] Callback fired before the action is sent to the other process.
 * @property [afterSend] Callback fired after the action is sent to the other process.
 */
type ForwardToMiddlewareOptions = {
  beforeSend?<A = any>(action: A): A;
  afterSend?<A = any>(action: A): A;
};

// Used as a fallback for undefined hooks.
const noop = <A = any>(action: A): A => action;

/**
 * Whenever an action is fired from the "main" process, forward it to the
 * "renderer" process to ensure global state is in sync.
 */
export function createForwardToRendererMiddleware(
  options?: ForwardToMiddlewareOptions,
): Middleware {
  const { webContents } = require("electron");

  const beforeSend = options?.beforeSend ?? noop;
  const afterSend = options?.afterSend ?? noop;

  return () => (next) => (action) => {
    if (!isValidAction(action)) {
      return next(action);
    }

    let forwardedAction = action as ForwardedAction;

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
      forwardedAction = beforeSend(forwardedAction);

      contentWindow.send(IpcChannel.ForMiddleware, forwardedAction);

      forwardedAction = afterSend(forwardedAction);
    }

    return next(action);
  };
}

/**
 * Whenever an action is fired from the "renderer" process, forward it to the
 * "main" process to ensure global state is in sync.
 */
export function createForwardToMainMiddleware(
  hooks?: ForwardToMiddlewareOptions,
): Middleware {
  const ipcRenderer = getIpcRenderer();

  const beforeSend = hooks?.beforeSend ?? noop;
  const afterSend = hooks?.afterSend ?? noop;

  return () => (next) => (action) => {
    if (!isValidAction(action)) {
      return next(action);
    }

    let forwardedAction = action as ForwardedAction;

    const wasAlreadyForwarded = wasActionAlreadyForwarded(forwardedAction);
    if (wasAlreadyForwarded) {
      return next(action);
    }

    // Actions with a double `@@` prefix usually indicate that it's
    // coming from (another) third-party:
    if (/^@@/.test(forwardedAction.type)) {
      return next(action);
    }

    forwardedAction = beforeSend(forwardedAction);

    ipcRenderer.send(IpcChannel.ForMiddleware, forwardedAction);

    // No reason to reassign `forwardedAction` here as this is the end of the
    // line. But it could be useful for logging or introspection:
    afterSend(forwardedAction);
  };
}

/**
 * Returns true if the specified action has already been forwarded to the
 * opposing process.
 *
 * @param action Action to check for meta indicating action already forwarded.
 */
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

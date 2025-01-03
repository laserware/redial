import type { Middleware } from "@laserware/stasis";

import { getIpcRenderer, IpcChannel } from "./common.js";
import type { AnyAction } from "./types.js";

/**
 * Redux action with additional metadata to indicate if the action was already
 * forwarded from the other process.
 *
 * @template P Payload of the forwarded action.
 */
export type ForwardedAction<P = any> = AnyAction<P> & {
  meta?: { wasAlreadyForwarded: boolean };
};

/**
 * Function that returns the forwarding middleware.
 */
export type CreateForwardingMiddlewareFunction = (
  // Calling this "options" instead of "hooks" in case we need to add anything
  // else here.
  options?: ForwardToMiddlewareOptions,
) => Middleware;

/**
 * Hooks that run before and after the action is sent from one process to another.
 * This is useful for doing things like ensuring the payload is serialized
 * prior to sending the action, or making a change to the action after it's
 * sent to the <i>renderer</i> process.
 *
 * Note that the `afterSend` hook has no effect after sending the action to the <i>main</i>
 * process, as `next` isn't called, but it could be useful for logging purposes.
 */
export type ForwardToMiddlewareOptions = {
  /**
   * Callback fired before the action is sent to the other process.
   *
   * @template P Payload of the forwarded action.
   *
   * @param action Action prior to forwarding.
   */
  beforeSend?<P = any>(action: ForwardedAction<P>): ForwardedAction<P>;

  /**
   * Callback fired after the action is sent to the other process.
   *
   * @template P Payload of the forwarded action.
   *
   * @param action Action after forwarding.
   */
  afterSend?<P = any>(action: ForwardedAction<P>): ForwardedAction<P>;
};

// Used as a fallback for undefined hooks.
const noop = <A = any>(action: A): A => action;

/**
 * Whenever an action is fired from the <i>main</i> process, forward it to the
 * <i>renderer</i> process to ensure global state is in sync.
 *
 * @internal
 */
export function createForwardToRendererMiddleware(
  options?: ForwardToMiddlewareOptions,
): Middleware {
  const { webContents } = require("electron");

  const beforeSend = options?.beforeSend ?? noop;
  const afterSend = options?.afterSend ?? noop;

  return () => (next) => (action) => {
    let forwardedAction = action as ForwardedAction;

    if (forwardedAction.meta?.wasAlreadyForwarded ?? false) {
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
 * Whenever an action is fired from the <i>renderer</i> process, forward it to the
 * <i>main</i> process to ensure global state is in sync.
 *
 * @internal
 */
export function createForwardToMainMiddleware(
  hooks?: ForwardToMiddlewareOptions,
): Middleware {
  const ipcRenderer = getIpcRenderer();

  const beforeSend = hooks?.beforeSend ?? noop;
  const afterSend = hooks?.afterSend ?? noop;

  return () => (next) => (action) => {
    let forwardedAction = action as ForwardedAction;

    // @ts-ignore
    if (forwardedAction.type?.startsWith("@@")) {
      return next(action);
    }

    const wasAlreadyForwarded =
      forwardedAction.meta?.wasAlreadyForwarded ?? false;

    const shouldBeForwarded = !wasAlreadyForwarded;

    if (shouldBeForwarded) {
      forwardedAction = beforeSend(forwardedAction);

      ipcRenderer.send(IpcChannel.ForMiddleware, forwardedAction);

      // No reason to reassign `forwardedAction` here as this is the end of the
      // line. But it could be useful for logging or introspection:
      afterSend(forwardedAction);

      return undefined;
    }

    return next(action);
  };
}

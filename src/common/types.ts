import type {
  Middleware,
  PayloadAction,
  UnknownAction,
} from "@reduxjs/toolkit";

/**
 * Represents a Redux [action](https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow#actions)
 * that could be unknown or has a specific payload `P`.
 *
 * @template P Payload of the action (if defined).
 */
export type AnyAction<P = any> = UnknownAction | PayloadAction<P>;

/**
 * Object that represents Redux [state](https://redux.js.org/tutorials/essentials/part-1-overview-concepts#state-management).
 */
export type AnyState = Record<string, any>;

/**
 * IPC channels for communicating between main and renderer processes.
 *
 * @internal
 */
export enum IpcChannel {
  FromMain = "@laserware/redial/from-main",
  FromRenderer = "@laserware/redial/from-renderer",
  ForStateSync = "@laserware/redial/state-sync",
}

/**
 * Additional data added to the `meta` property of an action to flag it as
 * forwarded. This is required to prevent infinite loops caused by repeatedly
 * dispatching the action after forwarding.
 */
export type RedialActionMeta = {
  /** If `true`, the action has already been forwarded. */
  forwarded: boolean;

  /** The BrowserWindow frame ID. */
  frameId: number;

  /** Source process from which the action was forwarded. */
  source: "main" | "renderer" | "unknown";
};

/**
 * Redux action with additional metadata to indicate if the action was already
 * forwarded from the other process.
 *
 * @remarks
 * The metadata is assigned to the `meta` property of the dispatched action in
 * middleware and forwarded to the opposing process (i.e. main process actions
 * are sent to the renderer process and vice versa).
 *
 * @template P Payload of the forwarded action.
 */
export type RedialAction<P = any> = AnyAction<P> & {
  meta: { redial: RedialActionMeta };
};

/**
 * Hooks that run before and after the action is sent from one process to another.
 * This is useful for doing things like ensuring the payload is serialized
 * prior to sending the action, or making a change to the action after it's
 * sent to the renderer process.
 *
 * Note that the `afterSend`
 *
 * @expand
 */
export type ForwardToMiddlewareOptions = {
  /**
   * Callback fired before the action is sent to the other process.
   *
   * @template P Payload of the forwarded action.
   *
   * @param action Action prior to forwarding.
   */
  beforeSend?<P = any>(action: RedialAction<P>): RedialAction<P>;

  /**
   * Callback fired after the action is sent to the other process.
   *
   * @template P Payload of the forwarded action.
   *
   * @param action Action after forwarding.
   */
  afterSend?<P = any>(action: RedialAction<P>): RedialAction<P>;
};

/**
 * Function that returns the forwarding middleware.
 *
 * @param [options] Options for forwarding middleware.
 *
 * @returns Redux middleware that forwards actions.
 */
export type CreateForwardingMiddlewareFunction = (
  // Calling this "options" instead of "hooks" in case we need to add anything
  // else here.
  options?: ForwardToMiddlewareOptions,
) => Middleware;

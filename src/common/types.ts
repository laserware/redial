import type {
  Middleware,
  PayloadAction,
  Store,
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

export enum IpcChannel {
  FromMain = "@laserware/redial/from-main",
  FromRenderer = "@laserware/redial/from-renderer",
  ForStateSync = "@laserware/redial/state-sync",
}

export type RedialActionMeta = {
  forwarded: boolean;
  frameId: number;
  source: "main" | "renderer" | "unknown";
};

/**
 * Redux action with additional metadata to indicate if the action was already
 * forwarded from the other process.
 *
 * @template P Payload of the forwarded action.
 */
export type RedialAction<P = any> = AnyAction<P> & {
  meta: { redial: RedialActionMeta };
};

export type RedialReturn<S> = {
  store: Store<S>;
  dispose(): void;
};

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
 */
export type CreateForwardingMiddlewareFunction = (
  // Calling this "options" instead of "hooks" in case we need to add anything
  // else here.
  options?: ForwardToMiddlewareOptions,
) => Middleware;

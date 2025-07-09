import type { PayloadAction, UnknownAction } from "@reduxjs/toolkit";
import type { IpcRendererEvent } from "electron";

/**
 * Represents a resource that can be cleaned up by calling the `dispose` method.
 */
export interface IDisposable {
  /** When called, cleans up any resources. */
  dispose(): void;
}

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
// biome-ignore lint/suspicious/noConstEnum: These are swapped out for their value in the build process.
export const enum IpcChannel {
  FromMain = "@laserware/redial/from-main",
  FromRenderer = "@laserware/redial/from-renderer",
  ForStateAsync = "@laserware/redial/state-async",
  ForStateSync = "@laserware/redial/state-sync",
}

/**
 * Redux action with additional metadata to indicate if the action was already
 * forwarded from the other process.
 *
 * @remarks
 * The metadata is assigned to the `meta` property of the dispatched action in
 * middleware and forwarded to the opposing process (i.e., main process actions
 * are sent to the renderer process and vice versa).
 *
 * @template P Payload of the forwarded action.
 */
export type RedialAction<P = any> = AnyAction<P> & {
  meta: { redial: { forwarded: boolean } };
};

/**
 * Hooks that run before and after the action are sent from one process to another.
 * This is useful for doing things like ensuring the payload is serialized
 * before sending the action, or making a change to the action after it's
 * sent to the renderer process.
 */
export interface RedialMiddlewareHooks {
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
}

export type RedialMainActionListener = (
  event: IpcRendererEvent,
  action: RedialAction,
) => void;

export interface RedialGlobals {
  forwardActionToMain(action: RedialAction): void;
  addMainActionListener(listener: RedialMainActionListener): void;
  removeMainActionListener(listener: RedialMainActionListener): void;
  requestMainStateAsync<S = AnyState>(): Promise<S>;
  requestMainStateSync<S = AnyState>(): S;
}

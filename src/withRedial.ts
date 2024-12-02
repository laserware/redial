import type { Store } from "@laserware/stasis";

import type { ProcessName } from "./common.js";
import {
  createForwardToMainMiddleware,
  createForwardToRendererMiddleware,
  type CreateForwardingMiddlewareFunction,
} from "./middleware.js";
import { replayActionInMain, replayActionInRenderer } from "./replay.js";
import { listenForStateRequests, requestStateFromMain } from "./syncState.js";
import type { AnyState } from "./types.js";

/**
 * Object available as the argument in the {@linkcode withRedial} initializer
 * function in the <i>main</i> process.
 *
 * @template S Type definition for Redux state.
 */
export type RedialMainInit<S> = {
  /**
   * Creates the forwarding middleware that forwards dispatched actions to the
   * <i>renderer</i> process.
   */
  createForwardingMiddleware: CreateForwardingMiddlewareFunction;

  /**
   * Replays the dispatched action from the <i>renderer</i> process in the
   * <i>main</i> process.
   *
   * @param store Redux store instance.
   */
  replayAction: (store: Store<S>) => void;

  /**
   * Synchronously sends the current state to the <i>renderer</i> process when
   * requested via {@linkcode RedialRendererInit.requestState}. This is
   * useful for preserving state between reloads in the <i>renderer</i> process.
   *
   * @param store Redux store instance.
   */
  listenForStateRequests: (store: Store<S>) => void;
};

/**
 * Object available as the argument in the {@linkcode withRedial} initializer
 * function in the <i>renderer</i> process.
 *
 * @template S Type definition for Redux state.
 */
export type RedialRendererInit<S> = {
  /**
   * Creates the forwarding middleware that forwards dispatched actions to the
   * <i>main</i> process.
   */
  createForwardingMiddleware: CreateForwardingMiddlewareFunction;

  /**
   * Replays the dispatched action from the <i>main</i> process in the
   * <i>renderer</i> process.
   *
   * @param store Redux store instance.
   */
  replayAction: (store: Store<S>) => void;

  /**
   * Synchronously request state from the <i>main</i> process.
   *
   * **Important Note**
   *
   * This will block the main thread until the state is returned from the
   * <i>main</i> process. You should only use this in development to keep state
   * synchronized between reloads of the renderer process.
   */
  requestState: () => S | undefined;
};

/**
 * Init options for the {@linkcode withRedial} initializer function based on
 * the {@linkcode ProcessName}.
 */
export type RedialInit<
  S extends AnyState,
  PN extends ProcessName,
> = PN extends "main"
  ? RedialMainInit<S>
  : PN extends "renderer"
    ? RedialRendererInit<S>
    : never;

/**
 * Convenience wrapper to provide the APIs for Electron IPC middleware when
 * configuring the Redux store.
 *
 * Note that you _must_ return the Redux store from the `initializer` callback.
 *
 * @template S Type definition for Redux state.
 * @template PN Process name in which to create store.
 *
 * @param processName Process name in which to create store (`"main"` or `"renderer"`).
 * @param initializer Callback with Electron IPC middleware APIs as the `options` argument.
 *
 * @example
 * import { configureStore } from "@reduxjs/toolkit";
 * import { withRedial } from "@laserware/redial";
 *
 * import { rootReducer } from "./rootReducer";
 *
 * function createStore() {
 *   return withRedial(
 *     "main",
 *     (createForwardToRendererMiddleware, replayAction, listenForStateRequests) => {
 *       const forwardToRendererMiddleware = createForwardToRendererMiddleware();
 *
 *       const store = configureStore({
 *         reducer: rootReducer,
 *         middleware: [forwardToRendererMiddleware],
 *       });
 *
 *       replayAction(store);
 *
 *       listenForStateRequests(store);
 *
 *       return store;
 *     },
 *   );
 * }
 */
export function withRedial<S extends AnyState, PN extends ProcessName>(
  processName: PN,
  initializer: (init: RedialInit<S, PN>) => Store<S>,
): Store<S> {
  if (processName === "main") {
    const options: RedialMainInit<S> = {
      createForwardingMiddleware: createForwardToRendererMiddleware,
      replayAction: replayActionInMain,
      listenForStateRequests,
    };

    // @ts-ignore Don't know why this is failing, but it's valid.
    return initializer(options);
  }

  if (processName === "renderer") {
    const options: RedialRendererInit<S> = {
      createForwardingMiddleware: createForwardToMainMiddleware,
      replayAction: replayActionInRenderer,
      requestState: requestStateFromMain,
    };

    // @ts-ignore Don't know why this is failing, but it's valid.
    return initializer(options);
  }

  // prettier-ignore
  throw new Error(`Invalid process name ${processName}, only "main" or "renderer" allowed`);
}

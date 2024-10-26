import type { Store } from "@laserware/stasis";

import type { ProcessName } from "./common.js";
import {
  createForwardToMainMiddleware,
  createForwardToRendererMiddleware,
  type CreateForwardingMiddlewareFunction,
} from "./middleware.js";
import { replayActionInMain, replayActionInRenderer } from "./replay.js";
import { listenForStateRequests, requestStateFromMain } from "./syncState.js";

type SynchronizeFunction<S, PN extends ProcessName> = PN extends "main"
  ? (store: Store<S>) => void
  : PN extends "renderer"
    ? () => S
    : never;

/**
 * Initializer callback used in the withRedial function.
 *
 * @template State Type definition for Redux state.
 * @template PN Process name in which to create store ("main" or "renderer").
 *
 * @callback WithRedialInitializer
 * @param createForwardingMiddleware Creates the forwarding middleware that forwards
 *     dispatched actions to the opposing process.
 * @param replayAction Replays the dispatched action from the opposing process in the
 *     current process.
 * @param synchronize Adds a listener to send Redux state from the main process to the
 *    "renderer" process when requested in the "main" process, or sends a synchronous
 *    request to the "main" process to get the current Redux state in the "renderer" process.
 */
type WithRedialInitializer<S, PN extends ProcessName> = (
  createForwardingMiddleware: CreateForwardingMiddlewareFunction,
  replayAction: (store: Store<S>) => void,
  synchronize: SynchronizeFunction<S, PN>,
) => Store<S>;

/**
 * Convenience wrapper to provide the APIs for Electron IPC middleware when
 * configuring the Redux store.
 *
 * Note that you _must_ return the Redux store from the initializer callback.
 *
 * @template S Type definition for Redux state.
 * @template PN Process name in which to create store ("main" or "renderer").
 *
 * @param processName Process name in which to create store ("main" or "renderer").
 * @param initializer Callback with Electron IPC middleware APIs as the options argument.
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
export function withRedial<S, PN extends ProcessName>(
  processName: PN,
  initializer: WithRedialInitializer<S, PN>,
): Store<S> {
  if (processName === "main") {
    return initializer(
      createForwardToRendererMiddleware,
      replayActionInMain,
      // @ts-ignore I don't know why this isn't working, but I know it's correct.
      listenForStateRequests,
    );
  }

  if (processName === "renderer") {
    return initializer(
      createForwardToMainMiddleware,
      replayActionInRenderer,
      // @ts-ignore I don't know why this isn't working, but I know it's correct.
      requestStateFromMain,
    );
  }

  // prettier-ignore
  throw new Error(`Invalid process name ${processName}, only "main" or "renderer" allowed`);
}

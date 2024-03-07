import type { Store } from "@laserware/stasis";

import type { ProcessName } from "./common";
import {
  createForwardToRendererMiddleware,
  createForwardToMainMiddleware,
  type ForwardToMiddlewareFunction,
} from "./middleware";
import {
  replayActionInMain,
  replayActionInRenderer,
  type ReplayActionFunction,
} from "./replay";
import {
  requestStateFromMain,
  listenForStateRequests,
  type SynchronizeStateFunction,
} from "./syncState";

/**
 * @param createForwardingMiddleware
 *    Creates the forwarding middleware that forwards dispatched actions to the
 *    opposing process.
 * @param replayAction
 *    Replays the dispatched action from the opposing process in the current process.
 * @param synchronize
 *    Adds a listener to send Redux state from the main process to the "renderer" process
 *    when requested in the "main" process, or sends a synchronous request to the "main"
 *    process to get the current Redux state in the "renderer" process.
 */
type WithRedialInitializer<State> = (
  createForwardingMiddleware: ForwardToMiddlewareFunction,
  replayAction: ReplayActionFunction<State>,
  synchronize: SynchronizeStateFunction<State>,
) => Store<State>;

/**
 * Convenience wrapper to provide the APIs for Electron IPC middleware when
 * configuring the Redux store.
 *
 * Note that you _must_ return the Redux store from the initializer callback.
 *
 * @template State Type definition for Redux state.
 * @template PN Process name in which to create store ("main" or "renderer").
 *
 * @param processName Process name in which to create store ("main" or "renderer").
 * @param initializer Callback with Electron IPC middleware APIs as the options argument.
 *
 * @example
 *  import { configureStore } from "@reduxjs/toolkit";
 *  import { withRedial } from "@laserware/redial";
 *
 *  import { rootReducer } from "./rootReducer";
 *
 *  function createStore() {
 *    return withRedial(
 *      "main",
 *      (createForwardToMainMiddleware, replayAction, listenForStateRequests) => {
 *        const forwardToRendererMiddleware = createForwardingMiddleware();
 *
 *        const store = configureStore({
 *          reducer: rootReducer,
 *          middleware: [forwardToRendererMiddleware],
 *        });
 *
 *        replayAction(store);
 *
 *        listenForStateRequests(store);
 *
 *        return store;
 *      },
 *    );
 *  }
 */
export function withRedial<State, PN extends ProcessName>(
  processName: PN,
  initializer: WithRedialInitializer<State>,
): Store<State> {
  if (processName === "main") {
    return initializer(
      createForwardToMainMiddleware,
      replayActionInMain,
      listenForStateRequests,
    );
  }

  if (processName === "renderer") {
    return initializer(
      createForwardToRendererMiddleware,
      replayActionInRenderer,
      requestStateFromMain,
    );
  }

  // prettier-ignore
  throw new Error(`Invalid process name ${processName}, only "main" or "renderer" allowed`);
}
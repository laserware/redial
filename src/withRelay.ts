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

interface WithElectronSharedOptions<State> {
  createForwardingMiddleware: ForwardToMiddlewareFunction;
  replayAction: ReplayActionFunction<State>;
}

interface WithElectronMainOptions<State>
  extends WithElectronSharedOptions<State> {
  listenForStateRequests: SynchronizeStateFunction<State>;
}

interface WithElectronRendererOptions<State>
  extends WithElectronSharedOptions<State> {
  requestStateFromMain: SynchronizeStateFunction<State>;
}

type WithElectronCallbackOptions<
  State,
  PN extends ProcessName,
> = PN extends "main"
  ? WithElectronMainOptions<State>
  : WithElectronRendererOptions<State>;

type WithElectronInitializer<State, PN extends ProcessName> = (
  options: WithElectronCallbackOptions<State, PN>,
) => Store<State>;

/**
 * Convenience wrapper to provide the APIs for Electron IPC middleware when
 * configuring the Redux store.
 *
 * Note that you _must_ return the Redux store from the initializer callback.
 *
 * @param processName Process name in which to create store ("main" or "renderer")
 * @param initializer Callback with Electron IPC middleware APIs as the options argument
 *
 * @example
 *  import { configureStore } from "@reduxjs/toolkit";
 *  import { withRelay } from "@laserware/relay";
 *
 *  function createStore() {
 *
 *  }
 */
export function withRelay<State, PN extends ProcessName>(
  processName: PN,
  initializer: WithElectronInitializer<State, PN>,
): Store<State> {
  if (processName === "main") {
    // @ts-ignore I don't know why this isn't working, but it's valid.
    return initializer({
      createForwardingMiddleware: createForwardToMainMiddleware,
      replayAction: replayActionInMain,
      listenForStateRequests,
    });
  }

  if (processName === "renderer") {
    // @ts-ignore I don't know why this isn't working, but it's valid.
    return initializer({
      createForwardingMiddleware: createForwardToRendererMiddleware,
      replayAction: replayActionInRenderer,
      requestStateFromMain,
    });
  }

  // prettier-ignore
  throw new Error(`Invalid process name ${processName}, only "main" or "renderer" allowed`);
}

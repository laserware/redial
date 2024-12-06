import type { PayloadAction, Store } from "@laserware/stasis";
import type { IpcMainEvent, IpcRendererEvent } from "electron";

import {
  IpcChannel,
  type ElectronMainApi,
  type ElectronRendererApi,
} from "./types.js";

/**
 * Listens for actions that were dispatched from the <i>renderer</i> process and
 * dispatches the action in the <i>main</i> process to keep the store in sync.
 *
 * @internal
 */
export function getReplayActionInMain(ipcMain: ElectronMainApi) {
  return <S>(store: Store<S>): void => {
    replayActionInProcessScope(ipcMain, store);
  };
}

/**
 * Listens for actions that were dispatched from the <i>main</i> process and
 * dispatches the action in the <i>renderer</i> process to keep the store in sync.
 *
 * @internal
 */
export function getReplayActionInRenderer(ipcRenderer: ElectronRendererApi) {
  return <S>(store: Store<S>): void => {
    replayActionInProcessScope(ipcRenderer, store);
  };
}

function replayActionInProcessScope<S>(
  ipc: ElectronMainApi | ElectronRendererApi,
  store: Store<S>,
): void {
  const handleReduxChannel = <P>(
    event: IpcMainEvent | IpcRendererEvent,
    action: PayloadAction<P>,
  ): void => {
    store.dispatch(action);
  };

  try {
    ipc.removeListener(IpcChannel.ForMiddleware, handleReduxChannel);
  } catch {
    // Do nothing.
  }

  ipc.addListener(IpcChannel.ForMiddleware, handleReduxChannel);
}

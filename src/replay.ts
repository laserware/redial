import type { PayloadAction, Store } from "@laserware/stasis";
import type {
  IpcMain,
  IpcMainEvent,
  IpcRenderer,
  IpcRendererEvent,
} from "electron";

import { getIpcMain, getIpcRenderer, IpcChannel } from "./common";

export type ReplayActionFunction<S> = (store: Store<S>) => void;

/**
 * Listens for actions that were dispatched from the renderer process and
 * dispatches the action in the main process to keep the store in sync.
 */
export function replayActionInMain<S>(store: Store<S>): void {
  const ipcMain = getIpcMain();

  replayActionInScope(ipcMain, store);
}

/**
 * Listens for actions that were dispatched from the main process and
 * dispatches the action in the renderer process to keep the store in sync.
 */
export function replayActionInRenderer<S>(store: Store<S>): void {
  const ipcRenderer = getIpcRenderer();

  replayActionInScope(ipcRenderer, store);
}

function replayActionInScope<S>(
  ipc: IpcMain | IpcRenderer,
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

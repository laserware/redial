import type { PayloadAction, Store } from "@laserware/stasis";
import type {
  IpcMain,
  IpcMainEvent,
  IpcRenderer,
  IpcRendererEvent,
} from "electron";

import { getIpcMain, getIpcRenderer, IpcChannel } from "./common.js";

/**
 * Listens for actions that were dispatched from the <i>renderer</i> process and
 * dispatches the action in the <i>main</i> process to keep the store in sync.
 *
 * @internal
 *
 * @template S Type definition for Redux state.
 *
 * @param store Redux store for the current process.
 */
export function replayActionInMain<S>(store: Store<S>): void {
  const ipcMain = getIpcMain();

  replayActionInProcessScope(ipcMain, store);
}

/**
 * Listens for actions that were dispatched from the <i>main</i> process and
 * dispatches the action in the <i>renderer</i> process to keep the store in sync.
 *
 * @internal
 *
 * @template S Type definition for Redux state.
 *
 * @param store Redux store for the current process.
 */
export function replayActionInRenderer<S>(store: Store<S>): void {
  const ipcRenderer = getIpcRenderer();

  replayActionInProcessScope(ipcRenderer, store);
}

function replayActionInProcessScope<S>(
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

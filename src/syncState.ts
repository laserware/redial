import type { Store } from "@laserware/stasis";
import type { IpcMainEvent } from "electron";

import { getIpcMain, getIpcRenderer, IpcChannel } from "./common.js";

/**
 * Adds an IPC listener that allows the <i>renderer</i> process to get the current
 * state when configuring the store. This is so state is persisted between
 * window reloads.
 *
 * @internal
 *
 * @template S Type definition for Redux state.
 *
 * @param store Redux store for the current process.
 */
export async function listenForStateRequests<S>(
  store: Store<S>,
): Promise<void> {
  const ipcMain = getIpcMain();

  const handleGetStateChannel = (event: IpcMainEvent): void => {
    event.returnValue = store.getState();
  };

  try {
    ipcMain.removeListener(IpcChannel.ForStateSync, handleGetStateChannel);
  } catch {
    // Do nothing.
  }

  ipcMain.addListener(IpcChannel.ForStateSync, handleGetStateChannel);
}

/**
 * Returns the state from the <i>main</i> process. If the state wasn't found, returns
 * undefined.
 *
 * Important! This is a synchronous function, so it blocks the main thread until
 * the state is returned from the <i>main</i> process. You should only use this function
 * in development to ensure state doesn't fall out of sync due to HMR or
 * browser refresh.
 *
 * @internal
 *
 * @template S Type definition for Redux state.
 */
export function requestStateFromMain<S>(): S | undefined {
  const ipcRenderer = getIpcRenderer();

  return ipcRenderer.sendSync(IpcChannel.ForStateSync);
}

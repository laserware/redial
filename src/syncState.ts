import type { Store } from "@laserware/stasis";
import type { IpcMainEvent } from "electron";

import { getIpcMain, getIpcRenderer, IpcChannel } from "./common.js";

/**
 * Adds an IPC listener that allows the "renderer" process to get the current
 * state when configuring the store. This is so state is persisted between
 * window reloads.
 *
 * @template State Type definition for Redux state.
 *
 * @param store Redux store for the current process.
 */
export async function listenForStateRequests<State>(
  store: Store<State>,
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
 * Returns the state from the "main" process. If the state wasn't found, falls
 * back to store.getState() (from the specified store).
 *
 * Important! This is a synchronous function, so it blocks the main thread until
 * the state is returned from the "main" process. You should only use this function
 * in development to ensure state doesn't fall out of sync due to HMR or
 * browser refresh.
 *
 * @template State Type definition for Redux state.
 *
 * @param store Redux store for the current process.
 */
export function requestStateFromMain<State>(store: Store<State>): State {
  const ipcRenderer = getIpcRenderer();

  const stateFromMain = ipcRenderer.sendSync(IpcChannel.ForStateSync);
  if (stateFromMain) {
    return stateFromMain;
  } else {
    return store.getState();
  }
}

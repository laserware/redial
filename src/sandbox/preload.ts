import { contextBridge, ipcRenderer } from "electron";

import { type AnyState, IpcChannel, type RedialAction } from "../types.js";
import {
  type RedialGlobals,
  type RedialMainActionListener,
  redialMainWorldApiKey,
} from "./globals.js";

/**
 * Adds an entry to the `window` object that sets up the communication layer
 * between the main and renderer processes. This _must_ be done to ensure the
 * communication layer functions correctly.
 *
 * @remarks
 * The API is added as `window.__laserware_redial__` and contains functions that
 * only facilitate messaging over specific IPC channel names. This ensures that
 * the communication layer follows Electron's recommended
 * [security practices](https://www.electronjs.org/docs/latest/tutorial/context-isolation#security-considerations)
 * by not exposing access to the entire `ipcRenderer` API.
 */
function preloadRedial(): void {
  const globals: RedialGlobals = {
    forwardActionToMain(action: RedialAction): void {
      ipcRenderer.send(IpcChannel.FromRenderer, action);
    },
    addMainActionListener(listener: RedialMainActionListener): void {
      ipcRenderer.addListener(IpcChannel.FromMain, listener);
    },
    removeMainActionListener(listener: RedialMainActionListener): void {
      ipcRenderer.removeListener(IpcChannel.FromMain, listener);
    },
    async requestMainStateAsync<S = AnyState>(): Promise<S> {
      return await ipcRenderer.invoke(IpcChannel.ForStateAsync);
    },
    requestMainStateSync<S = AnyState>(): S {
      return ipcRenderer.sendSync(IpcChannel.ForStateSync);
    },
  };

  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld(redialMainWorldApiKey, globals);
  } else {
    window[redialMainWorldApiKey] = globals;
  }
}

preloadRedial();

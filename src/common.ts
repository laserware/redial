import type { IpcMain, IpcRenderer } from "electron";

export enum IpcChannel {
  ForMiddleware = "@laserware/redial/middleware",
  ForStateSync = "@laserware/redial/state-sync",
}

/**
 * Name for the process scope. The [main process](https://www.electronjs.org/docs/latest/tutorial/process-model#the-main-process)
 * provides access to Node.js APIs while the [renderer process](https://www.electronjs.org/docs/latest/tutorial/process-model#the-renderer-process)
 * represents the browser.
 */
export type ProcessName = "main" | "renderer";

/**
 * Gets the `ipcMain` export from Electron. If this is called from the
 * <i>renderer</i> process, an error is thrown.
 *
 * @internal
 *
 * @returns The {@linkcode electron!IpcMain} export.
 */
export function getIpcMain(): IpcMain {
  if (getProcessScope() === "renderer") {
    throw new Error("ipcMain is not available in the renderer process");
  }

  return require("electron").ipcMain;
}

/**
 * Tries to find the `ipcRenderer` in the global scope (or via import).
 * If this is called from the <i>main</i> process, an error is thrown.
 *
 * @internal
 *
 * @returns The {@linkcode electron!IpcRenderer} export.
 */
export function getIpcRenderer(): IpcRenderer {
  // TODO: Allow user to specify their own IPC implementation (for context bridge).
  if (getProcessScope() === "main") {
    throw new Error("ipcRenderer is not available in the main process");
  }

  if ("require" in globalThis) {
    const electron = globalThis.require("electron") ?? null;
    if (electron !== null) {
      return electron.ipcRenderer;
    }
  }

  if (typeof window !== "undefined" && "require" in window) {
    const electron = window.require("electron") ?? null;
    if (electron !== null) {
      return electron.ipcRenderer;
    }
  }

  throw new Error("Unable to get ipcRenderer");
}

/**
 * Returns the process scope (i.e., main or renderer).
 *
 * @internal
 */
export function getProcessScope(): ProcessName {
  if (typeof window === "undefined" && typeof self === "undefined") {
    return "main";
  } else {
    return "renderer";
  }
}

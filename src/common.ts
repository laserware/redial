import type { IpcMain, IpcRenderer } from "electron";

export enum IpcChannel {
  ForMiddleware = "@laserware/redial/middleware",
  ForStateSync = "@laserware/redial/state-sync",
}

export type ProcessName = "main" | "renderer";

/**
 * Returns the `ipcMain` export from Electron. If this is called from the
 * renderer process, an error is thrown.
 */
export function getIpcMain(): IpcMain {
  if (getProcessScope() === "renderer") {
    throw new Error("ipcMain is not available in the renderer process");
  }

  return require("electron").ipcMain;
}

/**
 * Tries to find the `ipcRenderer` in the global scope (or via import), and
 * returns it. If this is called from the main process, an error is thrown.
 * @todo Allow user to specify their own IPC implementation (for context bridge).
 */
export function getIpcRenderer(): IpcRenderer {
  if (getProcessScope() === "main") {
    throw new Error("ipcRenderer is not available in the main process");
  }

  if (globalThis.require) {
    const electron = globalThis.require("electron");
    if (electron) {
      return electron.ipcRenderer;
    }
  }

  if (typeof window !== "undefined" && window.require) {
    const electron = window.require("electron");
    if (electron) {
      return electron.ipcRenderer;
    }
  }

  throw new Error("Unable to get ipcRenderer");
}

/**
 * Returns the process scope (i.e., main or renderer).
 */
export function getProcessScope(): ProcessName {
  if (typeof window === "undefined" && typeof self === "undefined") {
    return "main";
  } else {
    return "renderer";
  }
}

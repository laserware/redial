import type { PayloadAction, UnknownAction } from "@laserware/stasis";
import type { IpcMainEvent, IpcRendererEvent, WebContents } from "electron";

/**
 * Represents a Redux [action](https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow#actions) that could be unknown or has a specific payload `P`.
 *
 * @template P Payload of the action (if defined).
 */
export type AnyAction<P = any> = UnknownAction | PayloadAction<P>;

/**
 * Object that represents Redux [state](https://redux.js.org/tutorials/essentials/part-1-overview-concepts#state-management).
 */
export type AnyState = Record<string, any>;

/**
 * Name for the process scope. The [main process](https://www.electronjs.org/docs/latest/tutorial/process-model#the-main-process)
 * provides access to Node.js APIs while the [renderer process](https://www.electronjs.org/docs/latest/tutorial/process-model#the-renderer-process)
 * represents the browser.
 */
export type ProcessName = "main" | "renderer";

/**
 * IPC API needed for the <i>main</i> process.
 */
export type ElectronMainApi = {
  // prettier-ignore
  addListener(channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void): any;
  removeListener(channel: string, listener: (...args: any[]) => void): any;
  getAllWebContents(): WebContents[];
};

/**
 * IPC API needed for the <i>renderer</i> process.
 */
export type ElectronRendererApi = {
  // prettier-ignore
  addListener(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): any;
  removeListener(channel: string, listener: (...args: any[]) => void): any;
  send(channel: string, ...args: any[]): void;
  sendSync(channel: string, ...args: any[]): any;
};

/**
 * IPC API for either the <i>main</i> or <i>renderer</i> process based on the
 * specified `PN` process name.
 *
 * @template PN Process name for the Electron API.
 */
export type ElectronApiIn<PN extends ProcessName> = PN extends "main"
  ? ElectronMainApi
  : PN extends "renderer"
    ? ElectronRendererApi
    : never;

export enum IpcChannel {
  ForMiddleware = "@laserware/redial/middleware",
  ForStateSync = "@laserware/redial/state-sync",
}

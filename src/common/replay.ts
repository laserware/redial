import type { PayloadAction, Store } from "@laserware/stasis";
import type {
  IpcMain,
  IpcMainEvent,
  IpcRenderer,
  IpcRendererEvent,
} from "electron";

import { IpcChannel } from "./types.js";

export function replayActionInProcess<S>(
  ipcApi: IpcMain | Pick<IpcRenderer, "addListener" | "removeListener">,
  store: Store<S>,
): void {
  if (ipcApi.addListener === undefined) {
    throw new TypeError("IPC API must contain an `addListener` method");
  }

  if (ipcApi.removeListener === undefined) {
    throw new TypeError("IPC API must contain a `removeListener` method");
  }

  const handleReduxChannel = <P>(
    event: IpcMainEvent | IpcRendererEvent,
    action: PayloadAction<P>,
  ): void => {
    store.dispatch(action);
  };

  try {
    ipcApi.removeListener(IpcChannel.ForMiddleware, handleReduxChannel);
  } catch {
    // Do nothing.
  }

  ipcApi.addListener(IpcChannel.ForMiddleware, handleReduxChannel);
}

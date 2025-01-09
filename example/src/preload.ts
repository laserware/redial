import { contextBridge, ipcRenderer } from "electron";

import { exposeRedialInMainWorld } from "../../src/preload/exposeRedialInMainWorld.ts";
import type { RedialAction } from "../../src/types.ts";

exposeRedialInMainWorld();

contextBridge.exposeInMainWorld("api", {
  sendAction(action: RedialAction) {
    ipcRenderer.send("action", action);
  },
});

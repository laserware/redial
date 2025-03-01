import { contextBridge, ipcRenderer } from "electron";

import "../../dist/preload.cjs";
import type { RedialAction } from "../../src/types.ts";

contextBridge.exposeInMainWorld("api", {
  sendAction(action: RedialAction) {
    ipcRenderer.send("action", action);
  },
});

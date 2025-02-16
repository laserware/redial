import { contextBridge, ipcRenderer } from "electron";

import { preloadRedial } from "../../src/preload";
import type { RedialAction } from "../../src/types.ts";

preloadRedial();

contextBridge.exposeInMainWorld("api", {
  sendAction(action: RedialAction) {
    ipcRenderer.send("action", action);
  },
});

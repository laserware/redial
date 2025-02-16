import { contextBridge, ipcRenderer } from "electron";

import { preloadRedial } from "../../src/sandbox";
import type { RedialAction } from "../../src/types.ts";

preloadRedial();

contextBridge.exposeInMainWorld("api", {
  sendAction(action: RedialAction) {
    ipcRenderer.send("action", action);
  },
});

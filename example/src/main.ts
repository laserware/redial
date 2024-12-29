import { configureStore } from "@laserware/stasis";
import { app, BrowserWindow } from "electron";

import { redialMain } from "../../src/main";

import { counterSlice } from "./store";

function setup(): void {
  redialMain(({ createForwardingMiddleware }) => {
    const forwardToRendererMiddleware = createForwardingMiddleware();

    const store = configureStore({
      reducer: counterSlice.reducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(forwardToRendererMiddleware),
    });

    store.subscribe(() => {
      console.log(store.getState());
    });

    setTimeout(() => {
      setInterval(() => {
        store.dispatch(counterSlice.actions.increment());
      }, 2000);
    }, 1000);

    return store;
  });
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  mainWindow.loadFile("dist/renderer/index.html");
}

app.whenReady().then(() => {
  createWindow();

  setup();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", function () {
  app.quit();
});

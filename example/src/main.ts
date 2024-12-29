import { configureStore } from "@laserware/stasis";
import { app, BrowserWindow } from "electron";
import { installExtension, REDUX_DEVTOOLS } from "electron-devtools-installer";

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

    setInterval(() => {
      store.dispatch(counterSlice.actions.incrementFromMain());
    }, 2000);

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

app.whenReady().then(async () => {
  await installExtension(REDUX_DEVTOOLS, {
    loadExtensionOptions: {
      allowFileAccess: true,
    },
  });

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

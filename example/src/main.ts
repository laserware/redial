import { combineReducers, configureStore, type Store } from "@reduxjs/toolkit";
import { app, BrowserWindow, ipcMain } from "electron";

import { redialMain } from "../../src/main";

import { counterSlice } from "./store";

start();

async function start(): Promise<void> {
  await app.whenReady();

  createWindow();

  const store = createStore();

  ipcMain.addListener("increment", () => {
    store.dispatch(counterSlice.actions.increment());
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on("window-all-closed", function () {
    app.quit();
  });
}

function createStore(): Store {
  return redialMain(({ createForwardingMiddleware }) => {
    const forwardToRendererMiddleware = createForwardingMiddleware();

    return configureStore({
      reducer: combineReducers({
        counter: counterSlice.reducer,
      }),
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(forwardToRendererMiddleware),
    });
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

  const isDevelopment = /development/gi.test(import.meta.env.MODE);

  if (isDevelopment) {
    const port = Number(__DEV_SERVER_PORT__);

    mainWindow.loadURL(`http://localhost:${port}/index.html`);
  } else {
    mainWindow.loadFile("dist/renderer/index.html");
  }
}

import { join } from "node:path";

import { type Store, combineReducers, configureStore } from "@reduxjs/toolkit";
import { BrowserWindow, app, ipcMain } from "electron";

import { createRedialMainMiddleware } from "../../src/main";

import { counterSlice } from "./store";

start();

async function start(): Promise<void> {
  await app.whenReady();

  const store = createStore();

  createWindow();

  ipcMain.addListener("action", (event, action: any) => {
    store.dispatch(action);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

function createStore(): Store {
  const redialMiddleware = createRedialMainMiddleware();

  const store = configureStore({
    reducer: combineReducers({
      counter: counterSlice.reducer,
    }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(redialMiddleware),
  });

  app.on("before-quit", () => {
    redialMiddleware.dispose();
  });

  return store;
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "..", "preload", "preload.js"),
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

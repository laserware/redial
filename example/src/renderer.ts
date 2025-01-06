import { createElement as html } from "@laserware/dominator";
import { combineReducers, configureStore, type Store } from "@reduxjs/toolkit";

import { createRedialRendererMiddleware } from "../../src/renderer";

import { counterSlice } from "./store";

import classes from "./renderer.module.css";

declare global {
  interface Window {
    store: Store;
    require(name: string): any;
  }
}

const ipcRenderer = window.require("electron").ipcRenderer;

function createStore(): Store {
  const isDevelopment = /development/gi.test(import.meta.env.MODE);

  const redialMiddleware = createRedialRendererMiddleware(ipcRenderer);

  let preloadedState: any;

  if (isDevelopment) {
    preloadedState = redialMiddleware.getMainStateSync();
  }

  const store = configureStore({
    preloadedState,
    reducer: combineReducers({
      counter: counterSlice.reducer,
    }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(redialMiddleware),
  });

  window.addEventListener("beforeunload", () => {
    console.log("Disposing");
    redialMiddleware.dispose();
  });

  window.store = store;

  return store;
}

function start(): void {
  const store = createStore();

  const { actions } = counterSlice;

  const selectValue = counterSlice.selectors.selectValue;

  const output = html("output", selectValue(store.getState()).toString());

  const actionButton = (
    label: string,
    onclick: () => void,
  ): HTMLButtonElement =>
    html("button", { className: classes.button, onclick }, label);

  const rendererButtons = html(
    "div",
    { className: classes.buttonsContainer },
    actionButton("Increment", () => store.dispatch(actions.increment())),
    actionButton("Decrement", () => store.dispatch(actions.decrement())),
    actionButton("Reset", () => store.dispatch(actions.reset())),
  );

  const sendToMain = (action: any): void => ipcRenderer.send("action", action);

  const mainButtons = html(
    "div",
    { className: classes.buttonsContainer },
    actionButton("Increment", () => sendToMain(actions.increment())),
    actionButton("Decrement", () => sendToMain(actions.decrement())),
    actionButton("Reset", () => sendToMain(actions.reset())),
  );

  const base = html(
    "div",
    { className: classes.base },
    html("h1", "Example"),
    html("h2", "Renderer"),
    rendererButtons,
    html("h2", "Main"),
    mainButtons,
    html("h2", "Current Value"),
    output,
  );

  document.body.appendChild(base);

  store.subscribe(() => {
    const value = selectValue(store.getState());

    output!.innerHTML = value.toString();
  });
}

start();

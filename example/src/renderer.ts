import { combineReducers, configureStore, type Store } from "@reduxjs/toolkit";

import {
  createRedialRendererMiddleware,
  getMainStateSync,
} from "../../src/renderer";

import { counterSlice } from "./store";

declare global {
  interface Window {
    store: Store;
    require(name: string): any;
  }
}

function createStore(): Store {
  const ipcRenderer = window.require("electron").ipcRenderer;

  const isDevelopment = /development/gi.test(import.meta.env.MODE);

  const redialMiddleware = createRedialRendererMiddleware(ipcRenderer);

  let preloadedState: any;

  if (isDevelopment) {
    preloadedState = getMainStateSync(ipcRenderer);
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
  document.body.innerHTML = `
  <div>
    <h1>Example 3</h1>
    <button id="increment">Increment</button>
    <button id="decrement">Decrement</button>
    <button id="main">Main</button>
  
    <output id="output"></output>
  </div>
  `;

  const store = createStore();

  const incrementButton =
    document.querySelector<HTMLButtonElement>("#increment");
  const decrementButton =
    document.querySelector<HTMLButtonElement>("#decrement");
  const mainButton = document.querySelector<HTMLButtonElement>("#main");

  const output = document.querySelector<HTMLOutputElement>("output");

  incrementButton!.addEventListener("click", (event) => {
    event.preventDefault();
    store.dispatch(counterSlice.actions.increment());
  });

  decrementButton!.addEventListener("click", (event) => {
    event.preventDefault();
    store.dispatch(counterSlice.actions.decrement());
  });

  mainButton!.addEventListener("click", (event) => {
    event.preventDefault();

    window.require("electron").ipcRenderer.send("increment");
  });

  const selectValue = counterSlice.selectors.selectValue;

  output!.innerHTML = selectValue(store.getState()).toString();

  store.subscribe(() => {
    const value = selectValue(store.getState());

    output!.innerHTML = value.toString();
  });
}

start();

// @ts-ignore
import { configureStore } from "@laserware/stasis";

import { redialRenderer } from "../../src/renderer";

import { counterSlice } from "./store";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM content loaded!");

  setup();
});

function setup(): void {
  const ipcRenderer = window.require("electron").ipcRenderer;

  redialRenderer(ipcRenderer, ({ createForwardingMiddleware }) => {
    const forwardToMainMiddleware = createForwardingMiddleware();

    const store = configureStore({
      reducer: counterSlice.reducer,
      devTools: true,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(forwardToMainMiddleware),
    });

    store.subscribe(() => {
      console.log(store.getState());
    });

    setInterval(() => {
      store.dispatch(counterSlice.actions.incrementFromRenderer());
    }, 2000);

    return store;
  });
}

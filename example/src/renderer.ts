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

  const isDevelopment = /development/gi.test(import.meta.env.MODE);

  const store = redialRenderer(
    ipcRenderer,
    ({ createForwardingMiddleware, requestState }) => {
      const forwardToMainMiddleware = createForwardingMiddleware();

      let preloadedState: any;

      if (isDevelopment) {
        preloadedState = requestState();
      }

      return configureStore({
        preloadedState,
        reducer: counterSlice.reducer,
        devTools: true,
        middleware: (getDefaultMiddleware) =>
          getDefaultMiddleware().concat(forwardToMainMiddleware),
      });
    },
  );

  store.subscribe(() => {
    console.log(store.getState());
  });

  setInterval(() => {
    store.dispatch(counterSlice.actions.incrementFromRenderer());
  }, 2000);
}

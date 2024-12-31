# @laserware/redial

Redux IPC abstraction layer that uses middleware to forward actions between the main and renderer processes.

## Dependencies

- Node.js >= v22
- TypeScript >= 5
- Electron >= 30

## Usage

You'll need to set up the middleware in the main and renderer processes.

### Usage in the Main Process

Call the `createRedialMainMiddleware` function in your Redux store configuration code in the main process.

```ts
import { createRedialMainMiddleware } from "@laserware/redial/main";
import { configureStore, type Store } from "@reduxjs/toolkit";
import { app } from "electron";

import { rootReducer } from "../common/rootReducer";

export function createStore(): Store {
  const redialMiddleware = createRedialMainMiddleware();

  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(redialMiddleware),
  });

  app.on("before-quit", () => {
    // Perform cleanup:
    redialMiddleware.dispose();
  });
}
```

### Usage in the Renderer Process

Call the `createRedialRendererMiddleware` in your Redux store configuration code in the renderer process.

```ts
import { createRedialRendererMiddleware } from "@laserware/redial/renderer";
import { configureStore, type Store } from "@reduxjs/toolkit";

import { rootReducer } from "../common/rootReducer";

// Assuming no context isolation:
const ipcRenderer = window.require("electron").ipcRenderer;

export function createStore(): Store {
  const redialMiddleware = createRedialRendererMiddleware();

  let preloadedState;
  // If using Vite:
  if (import.meta.env.MODE === "development") {
    preloadedState = redialMiddleware.getMainStateSync();
  }

  const store = configureStore({
    preloadedState,
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(redialMiddleware),
  });
}
```

# Redial

Redux IPC abstraction layer that uses middleware to forward actions between the main and renderer processes.

## Dependencies

- Node.js >= v22
- TypeScript >= v5
- Electron >= v30

## Usage

Getting the library working is a three-step process:

1. Set up the communication layer in a `preload` script.
2. Add Redial middleware to the Redux store in the **main** process
3. Add Redial middleware to the Redux store in the **renderer** process

### Step 1: Expose Redial API in Preload Script

> [!NOTE]
> The preload step was added to v4 to ensure the library is adhering to recommended
> [security practices](https://www.electronjs.org/docs/latest/tutorial/context-isolation#security-considerations)
> when using the `ipcRenderer` API.

Import the preload script.

```js
/** src/preload.js */

import "@laserware/redial/preload";
```

### Step 2: Add Redial Middleware to Main Process Redux Store

Call the `createRedialMainMiddleware` function in your Redux store configuration code in the main process.

```ts
/** src/main.ts */

import { createRedialMainMiddleware } from "@laserware/redial/main";
import { configureStore, type Store } from "@reduxjs/toolkit";
import { app, BrowserWindow } from "electron";

import { rootReducer } from "../common/rootReducer";

function createStore(): Store {
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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      // Assuming the preload script is in the same directory 
      // as the `main` file output:
      preload: join(__dirname, "preload.js"),
    },
  });
}

async function start(): Promise<void> {
  await app.whenReady();
  
  createStore();
  
  createWindow();
}

start();
```

### Step 3: Add Redial Middleware to Renderer Process Redux Store

Call the `createRedialRendererMiddleware` in your Redux store configuration code in the renderer process.

```ts
/** src/renderer.ts */

import { createRedialRendererMiddleware } from "@laserware/redial/renderer";
import { configureStore, type Store } from "@reduxjs/toolkit";

import { rootReducer } from "../common/rootReducer";

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

## Migrating from v2 to v3

The API was completely changed in version 3 to use a single middleware import with methods, rather than returning the store from an initializer function (`withRedial`).

If you want to request the current state from the main process, the return value of `createRedialRendererMiddleware` provides two methods:

1. `getMainState`, which is asynchronous
2. `getMainStateSync`, which is synchronous (and blocking!)

```ts
export function createStore() {
  const redialMiddleware = createRedialRendererMiddleware();

  const stateFromMain = redialMiddleware.getMainStateSync();
}
```

In the main process, listeners are automatically added to return the state when requested.

## Migrating from v3 to v4

The preload step was added in version 4 to adhere to recommended security practices when using the `ipcRenderer` API.

You must now call `exposeRedialInMainWorld` in a preload script and load that script when creating a `BrowserWindow`.

See the [Usage](#usage) instructions above for additional information.

## Migrating from v4 to v5

The exported preload function was renamed from `exposeRedialInMainWorld` to `preloadRedial`.

```js
/** src/preload.js */

/* Before */
import { exposeRedialInMainWorld } from "@laserware/redial/preload";
/* After */
import { preloadRedial } from "@laserware/redial/preload";

// Set up the communication layer between the main and renderer processes:
/* Before */
exposeRedialInMainWorld();
/* After */
preloadRedial();
```

## Migrating from v5 to v6

The preload file was changed to a side-effect import.

```js
/** src/preload.js */

/* Before */
import { preloadRedial } from "@laserware/redial/preload";

preloadRedial();

/* After */
import "@laserware/redial/preload";
```

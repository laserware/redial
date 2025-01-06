/**
 * Used to set up action forwarding in the Electron renderer process. Middleware
 * must be added to both processes to ensure communication works.
 *
 * ## Usage
 * ```ts
 * import { createRedialRendererMiddleware } from "@laserware/redial/renderer";
 * import { configureStore, type Store } from "@reduxjs/toolkit";
 *
 * import { rootReducer } from "../common/rootReducer";
 *
 * // Assuming no context isolation:
 * const ipcRenderer = window.require("electron").ipcRenderer;
 *
 * export function createStore(): Store {
 *   const redialMiddleware = createRedialRendererMiddleware();
 *
 *   let preloadedState;
 *   // If using Vite:
 *   if (import.meta.env.MODE === "development") {
 *     preloadedState = redialMiddleware.getMainStateSync();
 *   }
 *
 *   const store = configureStore({
 *     preloadedState,
 *     reducer: rootReducer,
 *     middleware: (getDefaultMiddleware) =>
 *       getDefaultMiddleware().concat(redialMiddleware),
 *   });
 * }
 * ```
 *
 * @module renderer
 */

export {
  createRedialRendererMiddleware,
  type IpcRendererMethods,
  type RedialRendererMiddleware,
} from "./createRendererMiddleware.js";

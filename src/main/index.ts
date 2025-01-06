/**
 * Used to set up action forwarding in the Electron main process. Middleware
 * must be added to both processes to ensure communication works.
 *
 * ## Usage
 * ```ts
 * import { createRedialMainMiddleware } from "@laserware/redial/main";
 * import { configureStore, type Store } from "@reduxjs/toolkit";
 * import { app } from "electron";
 *
 * import { rootReducer } from "../common/rootReducer";
 *
 * export function createStore(): Store {
 *   const redialMiddleware = createRedialMainMiddleware();
 *
 *   const store = configureStore({
 *     reducer: rootReducer,
 *     middleware: (getDefaultMiddleware) =>
 *       getDefaultMiddleware().concat(redialMiddleware),
 *   });
 *
 *   app.on("before-quit", () => {
 *     // Perform cleanup:
 *     redialMiddleware.dispose();
 *   });
 * }
 * ```
 *
 * @module main
 */

export {
  createRedialMainMiddleware,
  type RedialMainMiddleware,
} from "./createMainMiddleware.js";

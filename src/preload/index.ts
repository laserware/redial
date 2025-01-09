/**
 * Used to set up the communication layer between the main and renderer processes.
 * This must be called in a preload script loaded via the `preload` option
 * in the [`webPreferences`](https://www.electronjs.org/docs/latest/api/structures/web-preferences)
 * option for a `BrowserWindow`.
 *
 * ## Usage
 *
 * ### `preload.js`
 * ```js
 * import { exposeRedialInMainWorld } from "@laserware/redial/preload";
 *
 * exposeRedialInMainWorld();
 * ```
 *
 * ### `main.js`
 * ```ts
 * import { join } from "node:path";
 *
 * import { BrowserWindow } from "electron";
 *
 * const mainWindow = new BrowserWindow({
 *   webPreferences: {
 *     contextIsolation: false,
 *     preload: join(__dirname, "preload.js"),
 *   }
 * });
 * ```
 *
 * @module preload
 */
export { exposeRedialInMainWorld } from "./exposeRedialInMainWorld.js";

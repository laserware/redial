import type { RedialGlobals } from "../common/types.js";

export const redialGlobalsApiKey: string = "__laserware_redial__";

declare global {
  interface Window {
    __laserware_redial__: RedialGlobals;
  }
}

export function getRedialGlobals(): RedialGlobals {
  const globals = globalThis[redialGlobalsApiKey];

  if (globals === undefined) {
    // biome-ignore format: Ignore
    const message = [
      "Unable to configure Redial middleware in the renderer process.",
      "You may have forgotten to import redial in a preload script from the main process.",
    ].join(" ");

    throw new Error(message);
  }

  return globalThis[redialGlobalsApiKey] as RedialGlobals;
}

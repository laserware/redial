import type { IpcRendererEvent } from "electron";
import type { AnyState, RedialAction } from "../types.js";

export const redialMainWorldApiKey: string = "__laserware_redial__";

export type RedialMainActionListener = (
  event: IpcRendererEvent,
  action: RedialAction,
) => void;

export interface RedialGlobals {
  forwardActionToMain(action: RedialAction): void;
  addMainActionListener(listener: RedialMainActionListener): void;
  removeMainActionListener(listener: RedialMainActionListener): void;
  requestMainStateAsync<S = AnyState>(): Promise<S>;
  requestMainStateSync<S = AnyState>(): S;
}

declare global {
  interface Window {
    __laserware_redial__: RedialGlobals;
  }
}

export function getRedialGlobals(): RedialGlobals {
  const globals = globalThis[redialMainWorldApiKey];

  if (globals === undefined) {
    // biome-ignore format:
    const message = [
      "Unable to configure Redial middleware in the renderer process.",
      "You may have forgotten to import redial in a preload script from the main process.",
    ].join(" ");

    throw new Error(message);
  }

  return globalThis[redialMainWorldApiKey] as RedialGlobals;
}

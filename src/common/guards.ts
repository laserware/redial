import type { Store } from "@reduxjs/toolkit";

import type { AnyAction, AnyState } from "./types.js";

/**
 * Checks if the specified value is a Redux store.
 *
 * @param value Value that may or may not be a Redux store.
 *
 * @returns `true` if the specified `value` is a Redux store.
 *
 * @internal
 */
export function isStore<S extends AnyState>(value: unknown): value is Store<S> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "getState" in value && "dispatch" in value && "subscribe" in value;
}

/**
 * Returns true if the specified `value` meets the minimum requirements for a
 * Flux Standard Action.
 *
 * @remarks
 * It _is_ possible that the `action` argument intercepted in Redux middleware
 * doesn't adhere to the FSA convention. This check is performed to ensure
 * we don't forward something that shouldn't get forwarded.
 *
 * @internal
 */
export function isAction(
  action: unknown,
): action is AnyAction & { meta?: any } {
  return typeof action === "object" && action !== null && "type" in action;
}

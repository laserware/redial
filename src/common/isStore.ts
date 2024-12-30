import type { Store } from "@reduxjs/toolkit";

import type { AnyState } from "./types.js";

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

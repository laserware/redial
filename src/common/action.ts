import type { AnyAction, RedialAction, RedialActionMeta } from "./types.js";

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
export function isActionLike(action: unknown): action is AnyAction {
  if (action === null) {
    return false;
  }

  return typeof action === "object" && "type" in action;
}

/**
 * Coerces the specified `action` to a {@linkcode RedialAction} by adding or
 * updating the `meta` property with {@linkcode RedialActionMeta}.
 *
 * @internal
 */
export function toRedialAction<P = any>(action: unknown): RedialAction<P> {
  const validAction = action as { meta?: any };

  if (isRedialAction(action)) {
    return validAction as RedialAction<P>;
  }

  const redialMeta: RedialActionMeta = {
    forwarded: false,
    frameId: 0,
    source: "unknown",
  };

  validAction.meta = {
    ...validAction.meta,
    redial: redialMeta,
  };

  return validAction as RedialAction<P>;
}

/**
 * Checks if the specified `action` was already forwarded from the specified
 * `source`.
 *
 * @param action Action to check.
 * @param source Source from which the action was forwarded.
 *
 * @returns `true` if the specified action has already been forwarded.
 *
 * @internal
 */
export function wasActionAlreadyForwarded(
  action: RedialAction,
  source: "main" | "renderer",
): boolean {
  return action.meta.redial.forwarded || action.meta.redial.source === source;
}

function isRedialAction<P = any>(value: any): value is RedialAction<P> {
  if (typeof value !== "object") {
    return false;
  }

  return "redial" in (value?.meta ?? {});
}

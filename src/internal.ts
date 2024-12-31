import type { RedialAction, RedialMiddlewareHooks } from "./types.js";

/**
 * Signature of the middleware forwarder function containing logic that is
 * shared between the main and renderer middlewares.
 *
 * @internal
 */
type MiddlewareForwarder = (
  /** Called with the action to move to the next middleware step (if any). */
  next: (action: unknown) => unknown,

  /** Action that was dispatched and intercepted in the middleware. */
  action: unknown,

  /** Callback called when the action is ready to be forwarded to the other process. */
  forward: (action: RedialAction) => void,
) => unknown;

/**
 * Provides a forwarder callback that wraps the middleware action checks to
 * ensure actions forwarded from either process are valid. The checks that
 * run before forwarding the action to the other process are the same, so we
 * captured them in a single place.
 *
 * @param hooks Optional hooks to call before and after forwarding the action.
 *
 * @internal
 */
export function getMiddlewareForwarder(
  hooks?: RedialMiddlewareHooks,
): MiddlewareForwarder {
  // Used as a fallback for undefined hooks.
  const noop = <A = any>(action: A): A => action;

  const beforeSend = hooks?.beforeSend ?? noop;
  const afterSend = hooks?.afterSend ?? noop;

  return (
    next: (action: unknown) => unknown,
    maybeAction: unknown,
    forward: (action: RedialAction) => void,
  ) => {
    let action = maybeAction as RedialAction;

    // If the action doesn't adhere to the Flux Standard Action convention,
    // it isn't forwarded:
    if (action?.type === undefined) {
      return next(action);
    }

    // Some actions are specific to libraries and are intended to be internal.
    // If that's the case, don't forward them. For example, `redux-form` uses
    // the `@@` prefix internally:
    if (action.type.startsWith("@@")) {
      return next(action);
    }

    // If the action was already forwarded, don't do it again:
    if (action.meta?.redial?.forwarded) {
      return next(action);
    }

    action = beforeSend(action);

    // We assign the forwarded property _after_ the hook to ensure the
    // library user doesn't make any changes to `redial.meta`, which would
    // break the application by causing an infinite dispatch loop:
    action.meta = { ...action.meta, redial: { forwarded: true } };

    forward(action);

    afterSend(action);

    return next(action);
  };
}

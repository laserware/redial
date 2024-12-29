import type { RedialAction, RedialActionMeta } from "./types.js";

export function isRedialAction<P = any>(value: any): value is RedialAction<P> {
  if (typeof value !== "object") {
    return false;
  }

  return "redial" in (value?.meta ?? {});
}

export function toRedialAction<P = any>(action: unknown): RedialAction<P> {
  const validAction = action as { meta?: any };

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

export function getRedialActionMeta(action: RedialAction): RedialActionMeta {
  const meta = action.meta?.redial ?? {};

  return {
    forwarded: meta.forwarded ?? false,
    frameId: meta.frameId ?? 0,
    source: meta.source ?? "unknown",
  };
}

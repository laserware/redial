import { EventEmitter } from "node:events";

import { configureStore, createSlice } from "@laserware/stasis";

import type { RedialAction } from "../../common/types.js";
import { getForwardToMainMiddlewareCreator } from "../middleware.js";

const counterSlice = createSlice({
  name: "counter",
  initialState: {
    value: 0,
  },
  reducers: {
    decrement(state) {
      state.value -= 1;
    },
    increment(state) {
      state.value += 1;
    },
  },
  selectors: {
    selectValue: (state) => state.value,
  },
});

describe("the getForwardToMainMiddlewareCreator function", () => {
  it("gets middleware that forwards actions to the main process", () => {
    const emitter = new EventEmitter();

    const beforeSend = vi.fn((action: any) => action);
    const afterSend = vi.fn((action: any) => action);
    const next = vi.fn((action: any) => action);

    const ipcRenderer = {
      addListener: vi.fn((channel: string, listener: any): any => {
        emitter.addListener(channel, listener);
        return vi.fn().mockReturnThis();
      }),
      removeListener: vi.fn((channel: string, listener: any): any => {
        emitter.removeListener(channel, listener);
        return vi.fn().mockReturnThis();
      }),
      sendSync: vi.fn(),
      send: vi.fn((channel: string, action: any) => {
        emitter.emit(channel, action);
      }),
    };

    const createMiddleware = getForwardToMainMiddlewareCreator(ipcRenderer);

    const middleware = createMiddleware({ beforeSend, afterSend });

    const store = configureStore({
      reducer: counterSlice.reducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(middleware),
    });

    expect(middleware(store)(next)(undefined)).toBeUndefined();

    next.mockClear();

    const prefixedAction = { type: "@@IGNORED" };
    expect(middleware(store)(next)(prefixedAction)).toEqual(prefixedAction);

    next.mockClear();

    const alreadyForwardedAction = {
      type: "TEST_ACTION",
      meta: { redial: { forwarded: true, source: "renderer", frameId: 0 } },
    };
    expect(middleware(store)(next)(alreadyForwardedAction)).toEqual(alreadyForwardedAction);

    next.mockClear();

    const incrementAction = counterSlice.actions.increment();
    const result = middleware(store)(next)(incrementAction) as RedialAction;
    expect(result.meta.redial).toEqual({ forwarded: true, source: "renderer", frameId: 0 });
    expect(beforeSend).toHaveBeenCalledWith(result);
    expect(afterSend).toHaveBeenCalledWith(result);
  });
});

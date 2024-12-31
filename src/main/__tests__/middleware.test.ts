import { configureStore, createSlice } from "@laserware/stasis";

import { IpcChannel, type RedialAction } from "../../common/types.js";
import { getForwardToRendererMiddlewareCreator } from "../middleware.js";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("electron", () => {
  const webContentsInstance = {
    id: 0,
    send: mocks.send,
  };

  return {
    webContents: {
      getAllWebContents: () => {
        return [webContentsInstance];
      },
    },
  };
});

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

describe("the getForwardToRendererMiddlewareCreator function", () => {
  beforeEach(() => {
    mocks.send.mockClear();
  });

  it("gets middleware that forwards actions to the renderer process with hooks", () => {
    const beforeSend = vi.fn((action: any) => action);
    const afterSend = vi.fn((action: any) => action);
    const next = vi.fn((action: any) => action);

    const createMiddleware = getForwardToRendererMiddlewareCreator();

    const middleware = createMiddleware({ beforeSend, afterSend });

    const store = configureStore({
      reducer: counterSlice.reducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(middleware),
    });

    expect(middleware(store)(next)(undefined)).toBeUndefined();

    next.mockClear();

    const alreadyForwardedAction = {
      type: "TEST_ACTION",
      meta: { redial: { forwarded: true } },
    };
    expect(middleware(store)(next)(alreadyForwardedAction)).toEqual(alreadyForwardedAction);

    next.mockClear();

    const incrementAction = counterSlice.actions.increment();
    const result = middleware(store)(next)(incrementAction) as RedialAction;
    expect(result.meta.redial).toEqual({ forwarded: true });
    expect(beforeSend).toHaveBeenCalledWith(result);
    expect(afterSend).toHaveBeenCalledWith(result);
    expect(mocks.send).toHaveBeenCalledWith(IpcChannel.FromMain, result);
  });

  it("gets middleware that forwards actions to the renderer process without hooks", () => {
    const next = vi.fn((action: any) => action);

    const createMiddleware = getForwardToRendererMiddlewareCreator();

    const middleware = createMiddleware();

    const store = configureStore({ reducer: counterSlice.reducer });

    const incrementAction = counterSlice.actions.increment();
    const result = middleware(store)(next)(incrementAction) as RedialAction;
    expect(result.meta.redial).toEqual({ forwarded: true });
    expect(mocks.send).toHaveBeenCalledWith(IpcChannel.FromMain, result);
  });
});

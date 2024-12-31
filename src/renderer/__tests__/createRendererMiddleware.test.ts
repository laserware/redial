import { EventEmitter } from "node:events";

import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";

import { IpcChannel, type RedialAction } from "../../types.js";

import {
  createRedialRendererMiddleware,
  type IpcRendererMethods,
} from "../createRendererMiddleware.js";

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

function getIpcRenderer(): IpcRendererMethods {
  const emitter = new EventEmitter();

  return {
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
      emitter.emit(channel, {}, action);
    }),
    invoke: vi.fn(() => Promise.resolve()),
  };
}

describe("the createRedialRendererMiddleware function", () => {
  it("creates middleware that forwards actions to the main process with hooks", () => {
    const COUNTER_INITIAL_VALUE = 10;

    const beforeSend = vi.fn((action: any) => action);
    const afterSend = vi.fn((action: any) => action);
    const next = vi.fn((action: any) => action);

    const ipcRenderer = getIpcRenderer();

    vi.mocked(ipcRenderer.sendSync).mockReturnValueOnce({
      counter: { value: COUNTER_INITIAL_VALUE },
    });

    const redialMiddleware = createRedialRendererMiddleware(ipcRenderer, { beforeSend, afterSend });

    const preloadedState = redialMiddleware.getMainStateSync();

    expect(ipcRenderer.sendSync).toHaveBeenCalledWith(IpcChannel.ForStateSync);

    const store = configureStore({
      preloadedState,
      reducer: combineReducers({ counter: counterSlice.reducer }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(redialMiddleware),
    });

    const anyFunc = expect.any(Function);
    expect(ipcRenderer.addListener).toHaveBeenCalledWith(IpcChannel.FromMain, anyFunc);

    expect(redialMiddleware(store)(next)(undefined)).toBeUndefined();

    next.mockClear();

    const prefixedAction = { type: "@@IGNORED" };
    expect(redialMiddleware(store)(next)(prefixedAction)).toEqual(prefixedAction);

    next.mockClear();

    const alreadyForwardedAction = {
      type: "TEST_ACTION",
      meta: { redial: { forwarded: true } },
    };
    expect(redialMiddleware(store)(next)(alreadyForwardedAction)).toEqual(alreadyForwardedAction);

    next.mockClear();

    const incrementAction = counterSlice.actions.increment();
    const result = redialMiddleware(store)(next)(incrementAction) as RedialAction;
    expect(result.meta.redial).toEqual({ forwarded: true });
    expect(beforeSend).toHaveBeenCalledWith(result);
    expect(afterSend).toHaveBeenCalledWith(result);

    type State = { counter: { value: number } };

    const stateChanges: State[] = [];

    const unsubscribe = store.subscribe(() => {
      stateChanges.push(store.getState());
    });

    let expected = COUNTER_INITIAL_VALUE - 1;
    ipcRenderer.send(IpcChannel.FromMain, counterSlice.actions.decrement());
    expect(stateChanges.pop()!.counter.value).toBe(expected);

    expected = COUNTER_INITIAL_VALUE;
    ipcRenderer.send(IpcChannel.FromMain, counterSlice.actions.increment());
    expect(stateChanges.pop()!.counter.value).toBe(expected);

    redialMiddleware.dispose();
    expect(ipcRenderer.removeListener).toHaveBeenCalled();

    unsubscribe();
  });

  it("creates middleware that forwards actions to the main process without hooks", () => {
    const ipcRenderer = getIpcRenderer();

    const next = vi.fn((action: any) => action);

    const redialMiddleware = createRedialRendererMiddleware(ipcRenderer);

    const store = configureStore({
      reducer: combineReducers({ counter: counterSlice.reducer }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(redialMiddleware),
    });

    const incrementAction = counterSlice.actions.increment();
    const result = redialMiddleware(store)(next)(incrementAction) as RedialAction;
    expect(result.meta.redial).toEqual({ forwarded: true });
  });

  it("creates middleware with getter functions for main state", async () => {
    const ipcRenderer = getIpcRenderer();

    const redialMiddleware = createRedialRendererMiddleware(ipcRenderer);

    const store = configureStore({
      reducer: combineReducers({ counter: counterSlice.reducer }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(redialMiddleware),
    });

    const expected = store.getState();

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce(expected);
    vi.mocked(ipcRenderer.sendSync).mockReturnValueOnce(expected);

    expect(await redialMiddleware.getMainState()).toEqual(expected);
    expect(redialMiddleware.getMainStateSync()).toEqual(expected);
  });
});

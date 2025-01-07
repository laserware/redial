import { type Mock, describe, expect, it, mock } from "bun:test";
import { EventEmitter } from "node:events";

import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";

import { IpcChannel, type RedialAction } from "../../types.js";

import {
  type IpcRendererMethods,
  createRedialRendererMiddleware,
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

function getIpcRenderer(): Record<keyof IpcRendererMethods, Mock<any>> {
  const emitter = new EventEmitter();

  return {
    addListener: mock((channel: string, listener: any): any => {
      emitter.addListener(channel, listener);
      return mock().mockReturnThis();
    }),
    removeListener: mock((channel: string, listener: any): any => {
      emitter.removeListener(channel, listener);
      return mock().mockReturnThis();
    }),
    sendSync: mock(),
    send: mock((channel: string, action: any) => {
      emitter.emit(channel, {}, action);
    }),
    invoke: mock(() => Promise.resolve()),
  };
}

describe("the createRedialRendererMiddleware function", () => {
  it("creates middleware that forwards actions to the main process with hooks", () => {
    const COUNTER_INITIAL_VALUE = 10;

    const beforeSend = mock((action: any) => action);
    const afterSend = mock((action: any) => action);
    const next = mock((action: any) => action);

    const ipcRenderer = getIpcRenderer();

    ipcRenderer.sendSync.mockReturnValueOnce({
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

    const next = mock((action: any) => action);

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

    ipcRenderer.invoke.mockResolvedValueOnce(expected);
    ipcRenderer.sendSync.mockReturnValueOnce(expected);

    expect(await redialMiddleware.getMainState()).toEqual(expected);
    expect(redialMiddleware.getMainStateSync()).toEqual(expected);
  });
});

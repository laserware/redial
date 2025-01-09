import { type Mock, describe, expect, it, mock } from "bun:test";
import { EventEmitter } from "node:events";

import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";

import { IpcChannel, type RedialAction } from "../../types.js";

import {
  type RedialMainActionListener,
  type RedialMainWorldApi,
  redialMainWorldApiKey,
} from "../../internal.js";
import { createRedialRendererMiddleware } from "../createRendererMiddleware.js";

const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
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

function getRedialMainWorldApi(
  emitter: EventEmitter = new EventEmitter(),
): Record<keyof RedialMainWorldApi, Mock<any>> {
  return {
    forwardActionToMain: mock((action: RedialAction): any => {
      emitter.emit(IpcChannel.FromRenderer, {}, action);
      return mock().mockReturnThis();
    }),
    addMainActionListener: mock((listener: RedialMainActionListener): any => {
      emitter.addListener(IpcChannel.FromMain, listener);
      return mock().mockReturnThis();
    }),
    removeMainActionListener: mock((listener: RedialMainActionListener): any => {
      emitter.removeListener(IpcChannel.FromMain, listener);
      return mock().mockReturnThis();
    }),
    requestMainStateSync: mock(),
    requestMainStateAsync: mock(() => Promise.resolve()),
  };
}

describe("the createRedialRendererMiddleware function", () => {
  it("creates middleware that forwards actions to the main process with hooks", () => {
    const COUNTER_INITIAL_VALUE = 10;

    const beforeSend = mock((action: any) => action);
    const afterSend = mock((action: any) => action);
    const next = mock((action: any) => action);

    const emitter = new EventEmitter();

    globalThis[redialMainWorldApiKey] = getRedialMainWorldApi(emitter);

    const globalMainWorldApi = globalThis[redialMainWorldApiKey];

    globalMainWorldApi.requestMainStateSync.mockReturnValueOnce({
      counter: { value: COUNTER_INITIAL_VALUE },
    });

    const redialMiddleware = createRedialRendererMiddleware({ beforeSend, afterSend });

    const preloadedState = redialMiddleware.getMainStateSync();

    expect(globalMainWorldApi.requestMainStateSync).toHaveBeenCalled();

    const store = configureStore({
      preloadedState,
      reducer: combineReducers({ counter: counterSlice.reducer }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(redialMiddleware),
    });

    const anyFunc = expect.any(Function);
    expect(globalMainWorldApi.addMainActionListener).toHaveBeenCalledWith(anyFunc);

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
    emitter.emit(IpcChannel.FromMain, {}, counterSlice.actions.decrement());
    expect(stateChanges.pop()!.counter.value).toBe(expected);

    expected = COUNTER_INITIAL_VALUE;
    emitter.emit(IpcChannel.FromMain, {}, counterSlice.actions.increment());
    expect(stateChanges.pop()!.counter.value).toBe(expected);

    redialMiddleware.dispose();
    expect(globalMainWorldApi.removeMainActionListener).toHaveBeenCalled();

    unsubscribe();
  });

  it("creates middleware that forwards actions to the main process without hooks", () => {
    const next = mock((action: any) => action);

    const redialMiddleware = createRedialRendererMiddleware();

    const store = configureStore({
      reducer: combineReducers({ counter: counterSlice.reducer }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(redialMiddleware),
    });

    const incrementAction = counterSlice.actions.increment();
    const result = redialMiddleware(store)(next)(incrementAction) as RedialAction;
    expect(result.meta.redial).toEqual({ forwarded: true });
  });

  it("creates middleware with getter functions for main state", async () => {
    globalThis[redialMainWorldApiKey] = getRedialMainWorldApi();

    const globalMainWorldApi = globalThis[redialMainWorldApiKey];

    const redialMiddleware = createRedialRendererMiddleware();

    const store = configureStore({
      reducer: combineReducers({ counter: counterSlice.reducer }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(redialMiddleware),
    });

    const expected = store.getState();

    globalMainWorldApi.requestMainStateAsync.mockResolvedValueOnce(expected);
    globalMainWorldApi.requestMainStateSync.mockReturnValueOnce(expected);

    expect(await redialMiddleware.getMainState()).toEqual(expected);
    expect(redialMiddleware.getMainStateSync()).toEqual(expected);
  });

  it("throws an error if the preload script wasn't run", () => {
    globalThis[redialMainWorldApiKey] = undefined;

    expect(() => {
      createRedialRendererMiddleware();
    }).toThrow(/Unable to configure middleware/);
  });
});

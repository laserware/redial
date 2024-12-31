import type { EventEmitter } from "node:events";

import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";
import { ipcMain } from "electron";
// eslint-disable-next-line no-restricted-imports
import type { Mock } from "vitest";

import { IpcChannel, type RedialAction } from "../../common/types.js";
import { createRedialMainMiddleware } from "../createMainMiddleware.js";

type State = { counter: { value: number } };

interface Mocks {
  emitter: EventEmitter;
  states: State[];
  listeners: Map<string, Mock>;
  send: Mock;
}

const mocks = vi.hoisted<Mocks>(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const EventEmitter = require("node:events");

  return {
    emitter: new EventEmitter(),
    states: [],
    listeners: new Map(),
    send: vi.fn(),
  };
});

vi.mock("electron", () => {
  const emitter = mocks.emitter;

  const webContentsInstance = {
    id: 0,
    send: mocks.send,
  };

  return {
    ipcMain: {
      addListener: vi.fn((channel: string, listener: any) => {
        const listenerMock = vi.fn(listener);

        mocks.listeners.set(channel, listenerMock);

        emitter.addListener(channel, listenerMock);
        return vi.fn().mockReturnThis();
      }),
      removeListener: vi.fn((channel: string, listener: any) => {
        mocks.listeners.delete(channel);

        emitter.removeListener(channel, listener);
        return vi.fn().mockReturnThis();
      }),
      removeHandler: vi.fn((channel: string) => {
        mocks.listeners.delete(channel);

        emitter.removeAllListeners(channel);
        return vi.fn().mockReturnThis();
      }),
      emit: (channel: string, action: any) => {
        return emitter.emit(channel, {}, action);
      },
      handle: vi.fn((channel: string, listener: any) => {
        const listenerHook = vi.fn((): void => {
          mocks.states.push(listener());
        });

        mocks.listeners.set(channel, listenerHook);

        emitter.addListener(channel, listenerHook);
        return vi.fn().mockReturnThis();
      }),
      once: vi.fn((channel: string, listener: any) => {
        emitter.once(channel, listener);
        return vi.fn().mockReturnThis();
      }),
    },
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

describe("the createRedialMainMiddleware function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets middleware that forwards actions to the renderer process with hooks", () => {
    const COUNTER_INITIAL_VALUE = 10;

    const beforeSend = vi.fn((action: any) => action);
    const afterSend = vi.fn((action: any) => action);
    const next = vi.fn((action: any) => action);

    const redialMiddleware = createRedialMainMiddleware({ beforeSend, afterSend });

    const store = configureStore({
      preloadedState: { counter: { value: COUNTER_INITIAL_VALUE } },
      reducer: combineReducers({ counter: counterSlice.reducer }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(redialMiddleware),
    });

    const anyFunc = expect.any(Function);
    expect(ipcMain.addListener).toHaveBeenCalledWith(IpcChannel.FromRenderer, anyFunc);
    expect(ipcMain.handle).toHaveBeenCalledWith(IpcChannel.ForStateAsync, anyFunc);
    expect(ipcMain.addListener).toHaveBeenCalledWith(IpcChannel.ForStateSync, anyFunc);

    expect(redialMiddleware(store)(next)(undefined)).toBeUndefined();

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
    expect(mocks.send).toHaveBeenCalledWith(IpcChannel.FromMain, result);

    const stateChanges: State[] = [];

    const unsubscribe = store.subscribe(() => {
      stateChanges.push(store.getState());
    });

    let expected = COUNTER_INITIAL_VALUE - 1;
    ipcMain.emit(IpcChannel.FromRenderer, counterSlice.actions.decrement());
    expect(stateChanges.pop()!.counter.value).toBe(expected);

    expected = COUNTER_INITIAL_VALUE;
    ipcMain.emit(IpcChannel.FromRenderer, counterSlice.actions.increment());
    expect(stateChanges.pop()!.counter.value).toBe(expected);

    const currentState = store.getState();
    ipcMain.emit(IpcChannel.ForStateAsync);
    expect(mocks.states[0]).toEqual(currentState);

    const syncListener = mocks.listeners.get(IpcChannel.ForStateSync)!;
    ipcMain.emit(IpcChannel.ForStateSync);
    expect(syncListener).toHaveBeenCalled();

    redialMiddleware.dispose();
    expect(ipcMain.removeListener).toHaveBeenCalledWith(IpcChannel.FromRenderer, anyFunc);
    expect(ipcMain.removeListener).toHaveBeenCalledWith(IpcChannel.ForStateSync, anyFunc);
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(IpcChannel.ForStateAsync);

    unsubscribe();
  });

  it("gets middleware that forwards actions to the renderer process without hooks", () => {
    const next = vi.fn((action: any) => action);

    const middleware = createRedialMainMiddleware();

    const store = configureStore({
      reducer: combineReducers({
        counter: counterSlice.reducer,
      }),
    });

    const incrementAction = counterSlice.actions.increment();
    const result = middleware(store)(next)(incrementAction) as RedialAction;
    expect(result.meta.redial).toEqual({ forwarded: true });
    expect(mocks.send).toHaveBeenCalledWith(IpcChannel.FromMain, result);
  });
});

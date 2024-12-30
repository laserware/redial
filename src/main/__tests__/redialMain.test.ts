import { configureStore, createSlice } from "@laserware/stasis";
import { ipcMain } from "electron";

import { IpcChannel } from "../../common/types.js";
import { redialMain } from "../index.js";

const mocks = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const EventEmitter = require("node:events");

  return { emitter: new EventEmitter() };
});

vi.mock("electron", () => {
  const emitter = mocks.emitter;

  return {
    ipcMain: {
      addListener: vi.fn((channel: string, listener: any) => {
        emitter.addListener(channel, listener);
        return vi.fn().mockReturnThis();
      }),
      removeListener: vi.fn((channel: string, listener: any) => {
        emitter.removeListener(channel, listener);
        return vi.fn().mockReturnThis();
      }),
      emit: (channel: string, ...args: any) => {
        return emitter.emit(channel, ...args);
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

describe("the redialMain function", () => {
  it("returns a Redux store with forwarding middleware and action replay", () => {
    const initializer = vi.fn().mockReturnValue(configureStore({ reducer: counterSlice.reducer }));

    const store = redialMain(initializer);

    const dispatchSpy = vi.spyOn(store, "dispatch");
    const getStateSpy = vi.spyOn(store, "getState");

    const anyFunc = expect.any(Function);

    expect(initializer).toHaveBeenCalled();
    expect(ipcMain.removeListener).toHaveBeenCalledWith(IpcChannel.FromRenderer, anyFunc);
    expect(ipcMain.addListener).toHaveBeenCalledWith(IpcChannel.FromRenderer, anyFunc);
    expect(ipcMain.removeListener).toHaveBeenCalledWith(IpcChannel.ForStateSync, anyFunc);
    expect(ipcMain.addListener).toHaveBeenCalledWith(IpcChannel.ForStateSync, anyFunc);

    const action = counterSlice.actions.increment();

    mocks.emitter.emit(IpcChannel.FromRenderer, {}, action);
    expect(dispatchSpy).toHaveBeenCalledWith(action);

    mocks.emitter.emit(IpcChannel.ForStateSync, { returnValue: "" });
    expect(getStateSpy).toHaveBeenCalled();
  });

  it("throws an error if the initializer does not return a valid store", () => {
    const initializer = vi.fn().mockReturnValue({});

    expect(() => {
      redialMain(initializer);
    }).toThrow(/not a Redux store/);
  });
});

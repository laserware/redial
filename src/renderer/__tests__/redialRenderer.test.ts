import { EventEmitter } from "node:events";

import { configureStore, createSlice } from "@laserware/stasis";

import { IpcChannel } from "../../common/types.js";
import { redialRenderer } from "../redialRenderer.js";

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

describe("the redialRenderer function", () => {
  it("returns a Redux store with forwarding middleware and action replay", () => {
    const emitter = new EventEmitter();

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

    ipcRenderer.sendSync.mockReturnValueOnce({ value: 10 });

    const store = redialRenderer(ipcRenderer, ({ createForwardingMiddleware, requestState }) => {
      const middleware = createForwardingMiddleware();

      const preloadedState = requestState() as any;

      return configureStore({
        preloadedState,
        // @ts-ignore
        reducer: counterSlice.reducer,
        // @ts-ignore
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(middleware),
      });
    });

    const dispatchSpy = vi.spyOn(store, "dispatch");

    const anyFunc = expect.any(Function);

    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(IpcChannel.FromMain, anyFunc);
    expect(ipcRenderer.addListener).toHaveBeenCalledWith(IpcChannel.FromMain, anyFunc);
    expect(ipcRenderer.sendSync).toHaveBeenCalledWith(IpcChannel.ForStateSync);

    const action = counterSlice.actions.decrement();

    emitter.emit(IpcChannel.FromMain, {}, action);
    expect(dispatchSpy).toHaveBeenCalledWith(action);
  });

  it("throws an error if the initializer does not return a Redux store", () => {
    const ipcRenderer = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      sendSync: vi.fn(),
      send: vi.fn(),
    };

    const initializer = vi.fn().mockReturnValue({});

    expect(() => {
      redialRenderer(ipcRenderer, initializer);
    }).toThrow(/not a Redux store/);
  });
});

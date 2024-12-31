import { EventEmitter } from "node:events";

import { combineReducers, configureStore, createSlice } from "@laserware/stasis";

import { beforeEach } from "vitest";

import type { IpcRendererMethods } from "../../common/types.js";
import { getMainState, getMainStateSync } from "../getMainState.js";

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

describe("within getMainState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("the getMainState function returns the main state asynchronously", async () => {
    const ipcRenderer = getIpcRenderer();

    const store = configureStore({
      reducer: combineReducers({ counter: counterSlice.reducer }),
    });

    const expected = store.getState();

    vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce(expected);

    const actual = await getMainState(ipcRenderer);

    expect(actual).toBe(expected);
  });

  it("the getMainStateSync function returns the main state synchronously", () => {
    const ipcRenderer = getIpcRenderer();

    const store = configureStore({
      reducer: combineReducers({ counter: counterSlice.reducer }),
    });

    const expected = store.getState();

    vi.mocked(ipcRenderer.sendSync).mockReturnValueOnce(expected);

    const actual = getMainStateSync(ipcRenderer);

    expect(actual).toBe(expected);
  });
});

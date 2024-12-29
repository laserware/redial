import { configureStore, createSlice } from "@laserware/stasis";

export const counterSlice = createSlice({
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

export function createStore() {
  return configureStore({
    reducer: {
      counter: counterSlice.reducer,
    },
  });
}

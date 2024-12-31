import { createSlice } from "@reduxjs/toolkit";

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
    reset(state) {
      state.value = 0;
    },
  },
  selectors: {
    selectValue: (state) => state.value,
  },
});

import { isStore } from "../isStore.js";

describe("the isStore function", () => {
  it("returns true for a valid Redux store object", () => {
    const STORE_FAKE = { getState: vi.fn(), dispatch: vi.fn(), subscribe: vi.fn() };

    expect(isStore(STORE_FAKE)).toBeTruthy();
  });

  it("returns false for an object missing 'getState'", () => {
    const STORE_FAKE = { dispatch: vi.fn(), subscribe: vi.fn() };

    expect(isStore(STORE_FAKE)).toBeFalsy();
  });

  it("returns false for an object missing 'dispatch'", () => {
    const STORE_FAKE = { getState: vi.fn(), subscribe: vi.fn() };

    expect(isStore(STORE_FAKE)).toBeFalsy();
  });

  it("returns false for an object missing 'subscribe'", () => {
    const STORE_FAKE = { getState: vi.fn(), dispatch: vi.fn() };

    expect(isStore(STORE_FAKE)).toBeFalsy();
  });

  it("returns false for a non-object value (null)", () => {
    expect(isStore(null)).toBeFalsy();
  });

  it("returns false for a non-object value (string)", () => {
    expect(isStore("not a store")).toBeFalsy();
  });

  it("returns false for a non-object value (number)", () => {
    expect(isStore(42)).toBeFalsy();
  });

  it("returns false for a plain object without store methods", () => {
    expect(isStore({})).toBeFalsy();
  });
});

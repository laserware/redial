import { isActionLike, toRedialAction, wasActionAlreadyForwarded } from "../action.js";
import type { RedialAction } from "../types.js";

describe("within action", () => {
  describe("the toRedialAction function", () => {
    it("adds redial metadata to an object without meta", () => {
      const ACTION_FAKE = { type: "TEST_ACTION" };

      const result = toRedialAction(ACTION_FAKE);

      expect(result.meta?.redial).toEqual({ forwarded: false, frameId: 0, source: "unknown" });
    });

    it("merges redial metadata with existing meta", () => {
      const ACTION_FAKE = { type: "TEST_ACTION", meta: { existing: "data" } };

      const result = toRedialAction(ACTION_FAKE);

      expect(result.meta.redial).toEqual({ forwarded: false, frameId: 0, source: "unknown" });
      // @ts-ignore
      expect(result.meta.existing).toBe("data");
    });

    it("returns the same action if it's already a RedialAction", () => {
      const ACTION_FAKE = {
        type: "TEST_ACTION",
        meta: { redial: { forwarded: true, frameId: 123, source: "main" } },
      };

      const result = toRedialAction(ACTION_FAKE);

      expect(result).toBe(ACTION_FAKE);
    });

    it("handles invalid input gracefully and adds metadata", () => {
      expect(() => {
        toRedialAction(null);
      }).toThrow();
    });
  });

  describe("the wasActionAlreadyForwarded function", () => {
    it("returns true if the action is already marked as forwarded", () => {
      const ACTION_FAKE: RedialAction = {
        type: "TEST_ACTION",
        meta: { redial: { forwarded: true, source: "main", frameId: 0 } },
      };

      expect(wasActionAlreadyForwarded(ACTION_FAKE, "renderer")).toBeTruthy();
    });

    it('returns true if the "source" matches the redial metadata source', () => {
      const ACTION_FAKE: RedialAction = {
        type: "TEST_ACTION",
        meta: { redial: { forwarded: false, source: "renderer", frameId: 0 } },
      };

      expect(wasActionAlreadyForwarded(ACTION_FAKE, "renderer")).toBeTruthy();
    });

    it('returns false if "forwarded" is false and "source" does not match', () => {
      const ACTION_FAKE: RedialAction = {
        type: "TEST_ACTION",
        meta: { redial: { forwarded: false, source: "main", frameId: 0 } },
      };

      expect(wasActionAlreadyForwarded(ACTION_FAKE, "renderer")).toBeFalsy();
    });

    it("handles actions without redial metadata gracefully", () => {
      const ACTION_FAKE = { meta: {} };

      expect(wasActionAlreadyForwarded(ACTION_FAKE as any, "main")).toBeFalsy();
    });
  });

  describe("the isActionLike function", () => {
    it.concurrent.each([
      { value: null, expected: false },
      { value: undefined, expected: false },
      { value: 42, expected: false },
      { value: "string", expected: false },
      { value: true, expected: false },
      { value: {}, expected: false },
      { value: { payload: "data" }, expected: false },
      { value: { type: "TEST_ACTION" }, expected: true },
      { value: { type: "ANOTHER_ACTION", payload: "data" }, expected: true },
    ])("returns $expected when value is $value", async ({ value, expected }) => {
      expect(isActionLike(value)).toBe(expected);
    });
  });
});

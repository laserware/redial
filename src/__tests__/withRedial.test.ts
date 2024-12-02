import { withRedial } from "../withRedial.js";

describe("the withRedial function", () => {
  it("accepts the correct types for the renderer process", () => {
    const store = withRedial(
      "renderer",
      ({ createForwardingMiddleware, replayAction, requestState }) => {
        const middleware = createForwardingMiddleware();
      },
    );
  });
});

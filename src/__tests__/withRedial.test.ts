import { withRedial } from "../withRedial.js";

describe("the withRedial function", () => {
  it("works for the main process", () => {
    const store = withRedial(
      "main",
      {
        addListener: () => vi.fn(),
        removeListener: () => vi.fn(),
        getAllWebContents: () => [],
      },
      ({
        createForwardingMiddleware,
        replayAction,
        listenForStateRequests,
      }) => {
        expect(createForwardingMiddleware).toBeTypeOf("function");
        expect(replayAction).toBeTypeOf("function");
        expect(listenForStateRequests).toBeTypeOf("function");

        return {} as any;
      },
    );

    expect(store).toBeTypeOf("object");
  });

  it("works for the renderer process", () => {
    const store = withRedial(
      "renderer",
      {
        addListener: () => vi.fn(),
        removeListener: () => vi.fn(),
        send: () => vi.fn(),
        sendSync: () => vi.fn(),
      },
      ({ createForwardingMiddleware, replayAction, requestState }) => {
        expect(createForwardingMiddleware).toBeTypeOf("function");
        expect(replayAction).toBeTypeOf("function");
        expect(requestState).toBeTypeOf("function");

        return {} as any;
      },
    );

    expect(store).toBeTypeOf("object");
  });
});

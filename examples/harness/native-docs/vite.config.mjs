export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-docs/parity.test.mjs"],
    testTimeout: 120000,
    // /docs/missing serializes its NotFound as a rejection; the server
    // render alone has no client to handle it (the contract's expected rejection).
    onUnhandledError: error => {
      const value = error?.name === "NotFound" ? error : error?.value;
      return !(
        process.env.NATIVE_DOCS_URL === "/docs/missing" &&
        value?.name === "NotFound" &&
        value?.message === "No article: missing"
      );
    }
  }
};

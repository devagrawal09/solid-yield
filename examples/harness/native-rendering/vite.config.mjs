export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-rendering/parity.test.mjs"],
    testTimeout: 180000,
    // /error-stream's bad item streams its rejection to the client, which
    // handles it there; a server render alone has no client (the expected
    // rejection, as the original's).
    onUnhandledError: error => {
      const value = error?.message ? error : error?.value;
      return !(
        process.env.NATIVE_RENDERING_TASK !== "client" &&
        /(^|,)\/error-stream(,|$)/.test(process.env.NATIVE_RENDERING_URLS ?? "") &&
        value?.message === "Item bad-item not found"
      );
    }
  }
};

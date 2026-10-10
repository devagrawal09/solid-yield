export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-dashboard/parity.test.mjs"],
    testTimeout: 120000,
    // /incidents/missing serializes its NotFound as a rejection; the server
    // render alone has no client to handle it (the contract's expected rejection).
    onUnhandledError: error => {
      const value = error?.name === "NotFound" ? error : error?.value;
      return !(
        process.env.NATIVE_DASHBOARD_URL === "/incidents/missing" &&
        value?.name === "NotFound" &&
        value?.message === "No incident: missing"
      );
    }
  }
};

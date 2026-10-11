export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-effect/parity.test.mjs"],
    testTimeout: 180000
  }
};

export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-sierpinski/parity.test.mjs"],
    testTimeout: 120000
  }
};

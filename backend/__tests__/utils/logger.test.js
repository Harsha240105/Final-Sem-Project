const { logger } = require("../../server/utils/logger");

describe("logger", () => {
  const log = logger("Test");

  it("should return an object with debug, info, warn, error methods", () => {
    expect(log).toHaveProperty("debug");
    expect(log).toHaveProperty("info");
    expect(log).toHaveProperty("warn");
    expect(log).toHaveProperty("error");
    expect(typeof log.info).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("should not throw when logging", () => {
    expect(() => log.info("test message")).not.toThrow();
    expect(() => log.debug("debug message")).not.toThrow();
    expect(() => log.warn("warn message")).not.toThrow();
    expect(() => log.error("error message")).not.toThrow();
  });
});

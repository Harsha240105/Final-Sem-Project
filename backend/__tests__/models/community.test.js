const mongoose = require("mongoose");
const Community = require("../../database/models/Community");

describe("Community Model", () => {
  it("should have required fields defined in schema", () => {
    const schemaPaths = Object.keys(Community.schema.paths);
    expect(schemaPaths).toContain("name");
    expect(schemaPaths).toContain("description");
    expect(schemaPaths).toContain("createdBy");
    expect(schemaPaths).toContain("members");
  });

  it("should have an array of members", () => {
    const membersPath = Community.schema.path("members");
    expect(membersPath).toBeDefined();
    expect(membersPath.instance).toBe("Array");
  });

  it("should have timestamps enabled", () => {
    expect(Community.schema.options.timestamps).toBe(true);
  });
});

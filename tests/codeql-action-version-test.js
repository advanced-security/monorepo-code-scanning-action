const assert = require("node:assert");
const { execFileSync } = require("node:child_process");

const references = execFileSync(
  "git",
  ["grep", "-hoE", "github/codeql-action/[a-z-]+@v[0-9]+"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");

assert(references.length > 0, "Expected to find CodeQL Action references");
assert(
  references.every((reference) => reference.endsWith("@v4")),
  `Expected all CodeQL Action references to use v4:\n${references.join("\n")}`,
);

console.log(`Verified ${references.length} CodeQL Action references use v4.`);

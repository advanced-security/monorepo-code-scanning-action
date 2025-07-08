const github = undefined;
const context = undefined;
const core = require("@actions/core");
core.debug = () => {};

console.log("Testing language-level queries functionality...\n");

// Test 1: Language-level queries should be applied when no project-level queries
console.log("Test 1: Language-level queries with no project-level queries");
process.env.projects = '{"csharp":{"queries":["security-and-quality"],"projects":{"Project1":{"paths":["src/FolderA"]}}}}';
process.env.filters = '{"changes":"[\\\"Project1\\\"]"}';
delete process.env.queries; // No global queries

const script = require("../changes/build-matrix.js");
const result1 = script(github, context, core);
const config1 = result1.projects[0].codeql_config;

if (config1.includes('queries:') && config1.includes('security-and-quality')) {
    console.log("✅ PASS: Language-level queries are applied\n");
} else {
    console.log("❌ FAIL: Language-level queries are NOT applied\n");
}

// Test 2: Project-level queries should override language-level queries
console.log("Test 2: Project-level queries override language-level queries");
process.env.projects = '{"csharp":{"queries":["security-and-quality"],"projects":{"Project1":{"paths":["src/FolderA"],"queries":["security-extended"]}}}}';
process.env.filters = '{"changes":"[\\\"Project1\\\"]"}';
delete process.env.queries; // No global queries

const result2 = script(github, context, core);
const config2 = result2.projects[0].codeql_config;

if (config2.includes('queries:') && config2.includes('security-extended') && !config2.includes('security-and-quality')) {
    console.log("✅ PASS: Project-level queries override language-level queries\n");
} else {
    console.log("❌ FAIL: Project-level queries do NOT override language-level queries\n");
}

// Test 3: Global queries should be used when no language or project queries
console.log("Test 3: Global queries used when no language or project queries");
process.env.projects = '{"csharp":{"projects":{"Project1":{"paths":["src/FolderA"]}}}}';
process.env.filters = '{"changes":"[\\\"Project1\\\"]"}';
process.env.queries = "security-default"; // Global queries

const result3 = script(github, context, core);
const config3 = result3.projects[0].codeql_config;

if (config3.includes('queries:') && config3.includes('security-default')) {
    console.log("✅ PASS: Global queries are used when no language or project queries\n");
} else {
    console.log("❌ FAIL: Global queries are NOT used when no language or project queries\n");
}

// Test 4: Language-level queries should override global queries
console.log("Test 4: Language-level queries override global queries");
process.env.projects = '{"csharp":{"queries":["security-and-quality"],"projects":{"Project1":{"paths":["src/FolderA"]}}}}';
process.env.filters = '{"changes":"[\\\"Project1\\\"]"}';
process.env.queries = "security-default"; // Global queries

const result4 = script(github, context, core);
const config4 = result4.projects[0].codeql_config;

if (config4.includes('queries:') && config4.includes('security-and-quality') && !config4.includes('security-default')) {
    console.log("✅ PASS: Language-level queries override global queries\n");
} else {
    console.log("❌ FAIL: Language-level queries do NOT override global queries\n");
}

// Test 5: No queries should result in no queries section
console.log("Test 5: No queries should result in no queries section");
process.env.projects = '{"csharp":{"projects":{"Project1":{"paths":["src/FolderA"]}}}}';
process.env.filters = '{"changes":"[\\\"Project1\\\"]"}';
delete process.env.queries; // No global queries

const result5 = script(github, context, core);
const config5 = result5.projects[0].codeql_config;

if (!config5.includes('queries:')) {
    console.log("✅ PASS: No queries section when no queries are specified\n");
} else {
    console.log("❌ FAIL: Queries section present when no queries are specified\n");
}

console.log("All tests completed!");
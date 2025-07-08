const github = undefined;
const context = undefined;
const core = require("@actions/core");
core.debug = () => {};

// Test case: language-level queries should be used when no project-level queries are set
process.env.projects = '{"csharp":{"queries":["security-and-quality"],"projects":{"Project1":{"paths":["src/FolderA"]},"Project2":{"paths":["src/FolderB"]}}}}';
process.env.filters = '{"changes":"[\\\"Project1\\\"]"}';

const script = require("../changes/build-matrix.js");
const result = script(github, context, core);

console.log("Test result:");
console.log(JSON.stringify(result, null, 2));

// Check if the language-level queries are properly applied
const project = result.projects[0];
const config = project.codeql_config;

console.log("\nCodeQL config:");
console.log(config);

// Check if queries are in the config
if (config.includes('queries:')) {
    console.log("\n✅ SUCCESS: Queries are present in the CodeQL config");
    if (config.includes('security-and-quality')) {
        console.log("✅ SUCCESS: Language-level queries (security-and-quality) are applied");
    } else {
        console.log("❌ FAILURE: Language-level queries (security-and-quality) are NOT applied");
    }
} else {
    console.log("\n❌ FAILURE: No queries found in CodeQL config");
}
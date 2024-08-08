const fs = require("fs");

async function run(github, context, core) {
  const languages = [
    "c-cpp",
    "csharp",
    "go",
    "javascript-typescript",
    "javascript",
    "python",
    "ruby",
    "swift",
    "java",
    "java-kotlin",
    "",
  ];

  let projects;
  try {
    projects = JSON.parse(process.env.projects);
  } catch (error) {
    console.error("Failed to parse projects, JSON error %s: \n\n%s", error, process.env.projects);
    return;
  }

  const scannedLanguages = projects.languages;

  if (!scannedLanguages) {
    console.error("Failed to parse languages, no languages found: %s", scannedLanguages);
    return;
  }

  const notScannedLanguages = scannedLanguages.filter(
    language => !scannedLanguages.includes(language)
  );

  // find the latest checks for the base branch, for each CodeQL language
  // the name will be "CodeQL - <language>"

  for (const language of notScannedLanguages) {

    if (language === "") {
      continue;
    }

    const checkName = `CodeQL - ${language}`;

    let checks;

    try {
      checks = await github.rest.checks.listForRef({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.payload.pull_request.base.ref,
        filter: "latest",
        check_name: checkName,
      });

      console.log("Checks for: " + checkName);
      console.log(checks.data);
    } catch (error) {
      return;
    }
  }

}

module.exports = (github, context, core) => {
  run(github, context, core).then(() => {});
};

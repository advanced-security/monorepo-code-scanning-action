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
  const scannedLanguages = JSON.parse(process.env.languages);
  const notScannedLanguages = languages.filter(
    (language) => !scannedLanguages.includes(language)
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

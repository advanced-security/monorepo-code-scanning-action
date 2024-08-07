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

  let scannedLanguages;
  try {
    scannedLanguages = JSON.parse(process.env.languages);
  } catch (error) {
    console.error("Failed to parse languages, JSON error %s: \n\n%s", error, process.env.languages);
    return;
  }

  const notScannedLanguages = languages.filter(
    (language) => !scannedLanguages.includes(language)
  );

  let analyses;

  try {
    analyses = await github.rest.codeScanning.listRecentAnalyses({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: context.payload.pull_request.base.ref,
    });
  } catch (error) {
    console.error("Failed to list recent analyses: %s", error);
    return;
  }

  const analysesToDownload = notScannedLanguages.map((language) =>
    analyses.data.find((analysis) => {
      const analysisLanguage = analysis.category.split(":")[1] || "";
      return analysisLanguage === language;
    })
  );

  if (analysesToDownload.length == 0) {
    console.warning("No analyses to download found, exiting");
  }

  fs.mkdirSync("sarif");
  analysesToDownload.forEach(async (analysis) => {
    if (analysis) {
      const sarif = await github.rest.codeScanning.getAnalysis({
        owner: context.repo.owner,
        repo: context.repo.repo,
        analysis_id: analysis.id,
        headers: {
          Accept: "application/sarif+json",
        },
      });
      fs.writeFileSync(
        `sarif/${analysis.category}.sarif`,
        JSON.stringify(sarif.data)
      );
      console.log(`Downloaded SARIF for ${analysis.category}`);
    }
  });
}

module.exports = (github, context, core) => {
  run(github, context, core).then(() => {});
};

const fs = require("fs");

async function run(github, context, core) {

  let projects;
  try {
    projects = JSON.parse(process.env.projects);
  } catch (error) {
    core.error(
      `Failed to parse projects, JSON error (${error}): \n\n${process.env.projects}`
    );
    return;
  }

  const scannedCategories = new Set();

  // TODO: needs to be generalized to support non-CodeQL code scanning tools, which can't be identified just by the language
  for (const project of Object.entries(projects)) {
    const language = project.language;
    const name = project.name;

    if (language === "") {
      continue;
    }

    scannedCategories.add(`/language:${language};project:${name}`);
  }

  let analyses;
  const ref = context.payload.pull_request.base.ref;

  try {
    analyses = await github.rest.codeScanning.listRecentAnalyses({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: ref,
    });
  } catch (error) {
    core.error(`Failed to list recent analyses: ${error}`);
    return;
  }

  core.debug(`Analyses for ${ref}: ${JSON.stringify(analyses)}`);

  // keep only categories that are not being scanned now
  const analysesOfMissingCategories = analyses.data.filter((analysis) => {
    return !scannedCategories.has(analysis.category);
  });

  core.debug(`Analyses of missing categories: ${JSON.stringify(analysesOfMissingCategories)}`);

  // filter down to the most recent analysis for each category, where that analysis is on the target of the PR
  // this approach *relies* on merging results from PRs onto the target branch, or running a complete analysis
  // on the target branch after each PR is merged
  const analysesByTarget = analysesOfMissingCategories
    .filter((analysis) => onTargetOfPR(analysis, context, core))
    // sort by most recent analysis first - use created_at key, decode as timestamp from ISO format
    .sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });

  core.debug(`Analyses on target: ${JSON.stringify(analysesByTarget)}`);

  // keep only the most recent analysis for each category
  const analysesToDownload = [];
  const categoriesSeen = new Set();

  analysesByTarget.forEach((analysis) => {
    if (!categoriesSeen.has(analysis.category)) {
      categoriesSeen.add(analysis.category);
      analysesToDownload.push(analysis);
    }
  });

  if (analysesToDownload.length == 0) {
    core.warning("No analyses to download found, exiting");
  }

  try {
    fs.mkdirSync("sarif");
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

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
        `sarif/${escapeForFilename(analysis.category)}.sarif`,
        JSON.stringify(sarif.data)
      );
      core.info(`Downloaded SARIF for ${analysis.category}`);
    }
  });
}

function escapeForFilename(category) {
  return category.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

function onTargetOfPR(analysis, context, core) {
  try {
    const analysis_ref = analysis.ref;
    const pr_base_ref = context.payload.pull_request.base.ref;

    if (analysis_ref === pr_base_ref) {
      return true;
    }

    if (analysis_ref.startsWith("refs/heads/") && !pr_base_ref.startsWith("refs/heads/")) {
      const analysis_ref_short = analysis_ref.substring("refs/heads/".length);
      return pr_base_ref === analysis_ref_short;
    }
  } catch(error) {
    core.error(`Failed to determine if analysis is on target of PR: ${error}`);
    core.error(`Analysis: ${JSON.stringify(analysis)}`);
    core.error(`Context: ${JSON.stringify(context)}`);
    return false;
  }
}

module.exports = (github, context, core) => {
  run(github, context, core).then(() => {});
};

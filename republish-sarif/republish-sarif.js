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

  // Create an array of promises for each download operation
  const downloadPromises = analysesToDownload.map(async (analysis) => {
    if (analysis) {
      try {
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
      } catch (error) {
        core.error(`Failed to download SARIF for ${analysis.category}: ${error}`);
      }
    }
  });

  // Wait for all downloads to complete
  await Promise.all(downloadPromises);
  
  // Count the SARIF files in the directory
  const sarifFiles = fs.readdirSync("sarif").filter(file => file.endsWith(".sarif"));
  const sarifFilesCount = sarifFiles.length;
  
  core.info(`Found ${sarifFilesCount} SARIF files in the directory`);

  // If there are more than 20 SARIF files, add a placeholder file to prevent the codeql-action from combining them
  if (sarifFilesCount > 20) {
    core.info(`Adding placeholder SARIF file to prevent combining of ${sarifFilesCount} SARIF files`);
    addPlaceholderSarifFile();
    core.info("Added placeholder SARIF file to prevent combining of SARIF files");
  }
}

/**
 * Adds a placeholder SARIF file with a non-CodeQL driver name to prevent combining of SARIF files.
 * 
 * Without this, if more than 20 SARIF files are uploaded at once, the following error occurs:
 * "Error: Code Scanning could not process the submitted SARIF file:
 * rejecting SARIF, as there are more runs than allowed (30 > 20)"
 * 
 * The codeql-action attempts to combine SARIF files only when all files are produced by CodeQL.
 * By adding a non-CodeQL SARIF file, we prevent this combination, allowing more than 20 files
 * to be processed individually without hitting the limit.
 */
function addPlaceholderSarifFile() {
  // Create a minimal SARIF file with a non-CodeQL driver name
  const placeholderSarif = {
    version: "2.1.0",
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "CodeQL-PREVENT-COMBINED-SARIF",
            version: "1.0.0",
            informationUri: "https://github.com/advanced-security/monorepo-code-scanning-action"
          }
        },
        results: [],
        properties: {
          comment: "This is a placeholder SARIF file to prevent the codeql-action from combining more than 20 SARIF files into a single upload, which would cause failures."
        }
      }
    ]
  };
  
  fs.writeFileSync(
    "sarif/placeholder-prevent-combine.sarif",
    JSON.stringify(placeholderSarif)
  );
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

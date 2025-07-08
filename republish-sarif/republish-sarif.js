const fs = require("fs");
const zlib = require("zlib");

/**
 * Main function to handle SARIF operations
 * 
 * Modes:
 * - 'download' (default): Downloads SARIF files from previous analyses (PR scenario)
 * - 'upload': Uploads SARIF files to GitHub Code Scanning (merge scenario)
 * 
 * Environment variables:
 * - SARIF_MODE: 'download' or 'upload'
 * - SARIF_DIR: Directory containing SARIF files (for upload mode, default: './sarif')
 * - projects: JSON string of projects being scanned (for download mode)
 */
async function run(github, context, core) {
  // Determine operation mode: 'download' for PR scenario, 'upload' for merge scenario
  const mode = process.env.SARIF_MODE || 'download';
  
  if (mode === 'upload') {
    core.info("Running in upload mode, uploading SARIF files");
    return await uploadSarifFiles(github, context, core);
  } else if (mode === 'download') {
    core.info("Running in download mode, downloading SARIF files from previous analyses");
    return await downloadSarifFiles(github, context, core);
  } else {
    core.error(`Unknown SARIF mode: ${mode}. Expected 'download' or 'upload'.`);
    return;
  }
}

async function downloadSarifFiles(github, context, core) {
  const sarifDir = process.env.SARIF_DIR || './sarif';
  fs.mkdirSync(sarifDir, { recursive: true });
  const projectsEnv = process.env.projects;

  if (!projectsEnv) {
    core.error("Environment variable 'projects' is not set. Cannot proceed with download.");
    return;
  }

  let projectsData;
  try {
    projectsData = JSON.parse(projectsEnv);
  } catch (error) {
    core.error(
      `Failed to parse projects, JSON error (${error}): \n\n${projectsEnv}`
    );
    return;
  }

  const projects = projectsData.projects || [];
  const allProjects = projectsData.all_projects || [];

  const scannedCategories = new Set();
  const validCategories = new Set();

  // TODO: needs to be generalized to support non-CodeQL code scanning tools, which can't be identified just by the language
  // Build set of categories that were scanned in this PR
  for (const project of projects) {
    const language = project.language;
    const name = project.name;

    if (language === "") {
      continue;
    }

    scannedCategories.add(`/language:${language};project:${name}`);
  }

  // Build set of all valid categories from currently defined projects
  for (const project of allProjects) {
    const language = project.language;
    const name = project.name;

    if (language === "") {
      continue;
    }

    validCategories.add(`/language:${language};project:${name}`);
  }

  let analyses;
  // Handle both PR and non-PR contexts
  const ref = context.payload.pull_request?.base?.ref || 
              context.ref || 
              `refs/heads/${context.payload.repository?.default_branch || 'main'}`;

  try {
    // Initialize an empty array to collect all analyses
    let allAnalyses = [];
    let page = 1;
    let hasNextPage = true;
    
    // Paginate through all analyses
    while (hasNextPage) {
      const response = await github.rest.codeScanning.listRecentAnalyses({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: ref,
        per_page: 100,
        page: page
      });
      
      allAnalyses = allAnalyses.concat(response.data);
      
      // Check if there are more pages
      if (response.data.length < 100) {
        hasNextPage = false;
      } else {
        page++;
      }
    }
    
    analyses = { data: allAnalyses };
  } catch (error) {
    core.error(`Failed to list recent analyses: ${error}`);
    return;
  }

  core.debug(`Analyses for ${ref}: ${JSON.stringify(analyses)}`);

  // keep only categories that are not being scanned now AND are valid current projects
  const analysesOfMissingCategories = analyses.data.filter((analysis) => {
    return !scannedCategories.has(analysis.category) && validCategories.has(analysis.category);
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

  // Download analyses in parallel
  await Promise.all(analysesToDownload.map(async (analysis) => {
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
          `${sarifDir}/${escapeForFilename(analysis.category)}.sarif`,
          JSON.stringify(sarif.data)
        );
        core.info(`Downloaded SARIF for ${analysis.category}`);
      } catch (error) {
        core.error(`Failed to download SARIF for ${analysis.category}: ${error.message}`);
      }
    }
  }));
}

function escapeForFilename(category) {
  return category.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

function onTargetOfPR(analysis, context, core) {
  try {
    const analysis_ref = analysis.ref;
    
    // Handle PR context
    if (context.payload.pull_request) {
      const pr_base_ref = context.payload.pull_request.base.ref;

      if (analysis_ref === pr_base_ref) {
        return true;
      }

      if (analysis_ref.startsWith("refs/heads/") && !pr_base_ref.startsWith("refs/heads/")) {
        const analysis_ref_short = analysis_ref.substring("refs/heads/".length);
        return pr_base_ref === analysis_ref_short;
      }
    } else {
      // Handle non-PR context (push to branch)
      const current_ref = context.ref || `refs/heads/${context.payload.repository?.default_branch || 'main'}`;
      
      if (analysis_ref === current_ref) {
        return true;
      }

      // Handle cases where refs might be in different formats
      if (analysis_ref.startsWith("refs/heads/") && !current_ref.startsWith("refs/heads/")) {
        const analysis_ref_short = analysis_ref.substring("refs/heads/".length);
        return current_ref === analysis_ref_short;
      }
      
      if (!analysis_ref.startsWith("refs/heads/") && current_ref.startsWith("refs/heads/")) {
        const current_ref_short = current_ref.substring("refs/heads/".length);
        return analysis_ref === current_ref_short;
      }
    }
    
    return false;
  } catch(error) {
    core.error(`Failed to determine if analysis is on target: ${error}`);
    core.error(`Analysis: ${JSON.stringify(analysis)}`);
    core.error(`Context: ${JSON.stringify(context)}`);
    return false;
  }
}

async function uploadSarifFiles(github, context, core) {
  const sarifDir = process.env.SARIF_DIR || './sarif';
  
  if (!fs.existsSync(sarifDir)) {
    core.warning(`SARIF directory ${sarifDir} does not exist, exiting`);
    return;
  }

  const sarifFiles = fs.readdirSync(sarifDir).filter(file => file.endsWith('.sarif'));
  
  if (sarifFiles.length === 0) {
    core.warning("No SARIF files found to upload, exiting");
    return;
  }

  core.info(`Found ${sarifFiles.length} SARIF files to upload`);

  // Get commit SHA and ref from context
  const commitSha = context.sha;
  const ref = context.ref;
  
  if (!commitSha) {
    core.error("Could not determine commit SHA for upload");
    return;
  }

  core.info(`Uploading to ref: ${ref}, commit: ${commitSha}`);

  for (const sarifFile of sarifFiles) {
    const filePath = `${sarifDir}/${sarifFile}`;
    
    try {
      const sarifContent = fs.readFileSync(filePath, 'utf8');
      const sarifData = JSON.parse(sarifContent);
      
      // Ensure SARIF has required properties for upload
      if (!sarifData.runs || sarifData.runs.length === 0) {
        core.warning(`SARIF file ${sarifFile} has no runs, skipping upload`);
        continue;
      }

      core.info(`Uploading SARIF file: ${sarifFile}`);
      
      // Prepare upload payload
      const uploadPayload = {
        owner: context.repo.owner,
        repo: context.repo.repo,
        commit_sha: commitSha,
        ref: ref,
        sarif: zlib.gzipSync(Buffer.from(sarifContent, 'utf8')).toString('base64'),
        checkout_uri: `https://github.com/${context.repo.owner}/${context.repo.repo}`,
        started_at: new Date().toISOString()
      };
      
      // Add tool name if available
      const toolName = sarifData.runs[0]?.tool?.driver?.name;
      if (toolName) {
        uploadPayload.tool_name = toolName;
      }
      
      const uploadResponse = await github.rest.codeScanning.uploadSarif(uploadPayload);

      core.info(`Successfully uploaded SARIF file ${sarifFile}, upload ID: ${uploadResponse.data.id}`);
      
      // Wait a bit between uploads to avoid rate limiting
      if (sarifFiles.indexOf(sarifFile) < sarifFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      core.error(`Failed to upload SARIF file ${sarifFile}: ${error.message}`);
      
      // Log more details if available
      if (error.response) {
        core.error(`HTTP Status: ${error.response.status}`);
        core.error(`Response: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
}

module.exports = (github, context, core) => {
  run(github, context, core).then(() => {});
};

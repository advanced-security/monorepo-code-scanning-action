// download_filtered_sarifs.js

const fs = require('node:fs');
const path = require('node:path');

async function run(github, context, core) {
  const repo = context.repo;

  // --- Input: Get the single excluded category from an environment variable ---
  // This value will be passed from your GitHub Actions workflow step (see workflow example below).
  const EXCLUDED_CATEGORY = process.env.EXCLUDED_CATEGORY_INPUT;

  if (!EXCLUDED_CATEGORY || EXCLUDED_CATEGORY.trim() === '') {
    core.setFailed("Error: 'EXCLUDED_CATEGORY_INPUT' environment variable is required and cannot be empty.");
    return;
  }

  // --- Dynamically determine the default branch for downloading analyses ---
  let targetRef;
  try {
    const { data: repoData } = await github.rest.repos.get({
      owner: repo.owner,
      repo: repo.repo,
    });
    targetRef = `refs/heads/${repoData.default_branch}`;
    core.info(`Dynamically determined default branch: '${repoData.default_branch}'. Will download analyses from '${targetRef}'.`);
  } catch (error) {
    core.setFailed(`Failed to get default branch for ${repo.owner}/${repo.repo}: ${error.message}`);
    return;
  }

  core.info(`EXCLUDING SARIFs with category: '${EXCLUDED_CATEGORY}'`);


  const DOWNLOAD_DIR = 'sarif_downloads';
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true }); // Ensure parent directories are created
    core.info(`Created directory: ${DOWNLOAD_DIR}`);
  } else {
    core.info(`Directory already exists: ${DOWNLOAD_DIR}`);
  }

  let allAnalyses = [];
  let page = 1;
  let hasNextPage = true;

  // --- 1. Fetch all recent Code Scanning analyses for the targetRef ---
  try {
    while (hasNextPage) {
      const response = await github.rest.codeScanning.listRecentAnalyses({
        owner: repo.owner,
        repo: repo.repo,
        ref: targetRef,
        per_page: 100, // Fetch 100 analyses per page
        page: page,
        tool_name: 'CodeQL' // Optionally filter by tool if you only want CodeQL SARIFs
      });

      allAnalyses = allAnalyses.concat(response.data);

      // Check if there are more pages to fetch
      if (response.data.length < 100) {
        hasNextPage = false;
      } else {
        page++;
      }
    }
    core.info(`Found ${allAnalyses.length} total recent analyses for ref: '${targetRef}'`);
  } catch (error) {
    core.setFailed(`Failed to list recent analyses for '${targetRef}': ${error.message}`);
    // Provide more detail for common errors like 404 (no analyses found)
    if (error.status === 404) {
      core.warning(`No CodeQL analyses found for ref: '${targetRef}'. Ensure analyses exist for this branch.`);
    }
    return;
  }

  // --- 2. Filter out analyses based on the single EXCLUDED_CATEGORY ---
  const analysesToDownload = [];
  const categoriesSeen = new Set(); // To ensure we only download the most recent analysis for each unique category

  // Sort by created_at (most recent first) to ensure we get the latest if multiple analyses exist for a category
  allAnalyses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const analysis of allAnalyses) {
    // Check if the category matches our single excluded category
    if (analysis.category === EXCLUDED_CATEGORY) {
      core.info(`Skipping analysis for excluded category: '${analysis.category}' (ID: ${analysis.id})`);
      continue; // Skip to the next analysis if it's the excluded one
    }

    // Ensure we only download the most recent analysis for each unique category found after exclusion
    if (!categoriesSeen.has(analysis.category)) {
      categoriesSeen.add(analysis.category);
      analysesToDownload.push(analysis);
    } else {
      core.debug(`Skipping older analysis for category '${analysis.category}' (ID: ${analysis.id})`);
    }
  }

  if (analysesToDownload.length === 0) {
    core.info("No analyses found to download after filtering. Exiting.");
    return;
  }

  core.info(`Attempting to download ${analysesToDownload.length} SARIF files after filtering.`);

  // --- 3. Download the filtered SARIF files ---
  // Use Promise.all to download files concurrently
  await Promise.all(analysesToDownload.map(async (analysis) => {
    try {
      const sarifId = analysis.id;
      const category = analysis.category;
      // Generate a clean filename from the category
      const fileName = category.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '.sarif';
      const filePath = path.join(DOWNLOAD_DIR, fileName);

      core.info(`Downloading SARIF for category '${category}' (ID: ${sarifId})`);

      // Make a direct API call to get the SARIF content
      const sarifResponse = await github.rest.codeScanning.getAnalysis({
        owner: repo.owner,
        repo: repo.repo,
        analysis_id: sarifId,
        headers: {
          Accept: "application/sarif+json", // Crucial: Request SARIF JSON directly
        },
      });

      const sarifContent = sarifResponse.data;

      // Basic validation for received content
      if (!sarifContent || (typeof sarifContent === 'object' && Object.keys(sarifContent).length === 0) || (typeof sarifContent === 'string' && sarifContent.trim().length === 0)) {
        core.warning(`SARIF content received is empty or malformed for analysis ID ${analysis.id} (category: '${category}'). Skipping write.`);
        core.debug(`Received SARIF content (raw): ${sarifContent}`);
        return;
      }

      // Write the SARIF content to a file
      fs.writeFileSync(filePath, JSON.stringify(sarifContent, null, 2)); // Pretty print JSON for readability
      core.info(`Successfully downloaded SARIF for '${category}' to '${filePath}'`);

    } catch (error) {
      core.error(`Failed to download SARIF for analysis ID ${analysis.id} (category: '${analysis.category}'): ${error.message}`);
      // Log the error but don't fail the whole job so other downloads can proceed
      // If you want the job to fail on any download error, you'd re-throw or setFailed here.
    }
  }));

  core.info("All filtered SARIF files processed and downloaded.");
}

// This is the entry point for actions/github-script
module.exports = (github, context, core) => {
  run(github, context, core).then(() => {});
};

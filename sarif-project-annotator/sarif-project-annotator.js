const fs = require('fs').promises

async function run(github, context, core) {
  try {
    // Get input parameters
    const project = process.env.project
    const sarifInput = process.env.sarif_file
    const outputFile = process.env.output_file

    // Read the input SARIF file  (note this does convert value:1.0 to value:1 )
    const sarifContent = await fs.readFile(sarifInput, 'utf8')
    const sarifData = JSON.parse(sarifContent)

    // Process each run in the SARIF file
    for (const sarifRun of sarifData.runs) {

      // Rule property tag information is at runs[].tool.extensions[].rules[].properties.tags[]
      for (const rule of sarifRun.tool.extensions[0].rules || []) {
        if (rule.properties && rule.properties.tags) {
          // Check if the rule already has a project tag
          const existingTagIndex = rule.properties.tags.findIndex(tag => tag.startsWith('project/'))

          // If it does, remove it
          if (existingTagIndex !== -1) {
            core.debug(`Removing existing project tag: ${rule.properties.tags[existingTagIndex]}`)
            rule.properties.tags.splice(existingTagIndex, 1)
          }

          // Add the new project tag
          core.debug(`Adding new project tag: project/${project} to rule ${rule.id}`)
          rule.properties.tags.push(`project/${project}`)
        }
      }
    }

    // Write the updated SARIF to the output file
    await fs.writeFile(outputFile, JSON.stringify(sarifData, null, 2), 'utf8')

    console.log(`Updated SARIF file for project '${project}' written to ${outputFile}`)
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

module.exports = async (github, context, core) => {
  await run(github, context, core)
};
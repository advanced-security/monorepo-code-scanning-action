//const core = require('@actions/core')
const fs = require('fs').promises

async function run(github, context, core) {
  try {
    // Get input parameters
    const project = process.env.project
    const sarifInput = process.env.sarif_file
    const outputFile = process.env.output_file

    //Fix was to pass as env vars - Error: Action failed with error: Error: Input required and not supplied: project
    // const project = core.getInput('project', { required: true })
    // const sarifInput = core.getInput('sarif_file', { required: true })
    // const outputFile = core.getInput('output_file', { required: true })

    // Read the input SARIF file  (note this does convert value:1.0 to value:1 )
    const sarifContent = await fs.readFile(sarifInput, 'utf8')
    const sarifData = JSON.parse(sarifContent)

    //#region Support projects.json file (not needed)
    // const projectsJson = core.getInput('projects-json', { required: true })
    // // Read the projects JSON file
    // const projectsContent = await fs.readFile(projectsJson, 'utf8')
    // const projectsData = JSON.parse(projectsContent)

    // // Create a map of file paths to project names
    // const projectMap = new Map()
    // for (const [projectName, projectInfo] of Object.entries(projectsData.csharp.projects)) {
    //   for (const projectPath of projectInfo.paths) {
    //     projectMap.set(projectPath, projectName)
    //   }
    // }
    //#endregion

    // Process each run in the SARIF file
    for (const sarifRun of sarifData.runs) {

      //#region Per location tags (no tags possible here)
      //   //File path information is at runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri
      //   for (const result of sarifRun.results || []) {
      //     const filePath = result.locations[0].physicalLocation.artifactLocation.uri
      //     const projectName = [...projectMap.entries()].find(([key, value]) => filePath.includes(key))?.[1]

      //     if (projectName) {
      //       // Add project as a tag
      //       if (!result.properties) result.properties = {}
      //       if (!result.properties.tags) result.properties.tags = []

      //       // Check if a project tag already exists and remove it
      //       result.properties.tags = result.properties.tags.filter(
      //         tag => !tag.includes('project/')
      //       )

      //       // Add the new project tag
      //       result.properties.tags.push(`project/${projectName}`)
      //     }
      //   }
      //#endregion

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
  //run(github, context, core).then(() => {});
  await run(github, context, core)
};
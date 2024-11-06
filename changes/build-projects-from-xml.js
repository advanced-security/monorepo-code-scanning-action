const fs = require("fs");
const xml2js = require("xml2js");
const yaml = require("yaml");

function run(github, context, core) {
  const { filename, variables } = process.env;

  if (!filename) {
    if (core) {
      core.setFailed("filename is required");
    }
    return;
  }

  if (!variables) {
    if (core) {
      core.warning(
        "Setting the 'variables' inputs is recommended, to properly resolve paths in the build XML that are substituted with a variable of the form $(VAR)"
      );
    }
  }

  const parsed_variables = variables ? yaml.parse(variables) : {};

  fs.readFile(filename, "utf8", (err, data) => {
    if (err) {
      if (core) {
        core.setFailed(err.message);
      }
      return;
    }

    xml2js.parseString(data, (err, result) => {
      if (err) {
        if (core) {
          core.setFailed(err.message);
        }
        return;
      }

      const itemGroup = result.Project.ItemGroup[0];
      const groupedIncludes = {};

      for (const tagName in itemGroup) {
        groupedIncludes[tagName] = [
          ...new Set(
            itemGroup[tagName].map((item) =>
              item.$.Include.split("\\").slice(0, -1).join("/")
            )
          ),
        ];
      }

      // replace the variables with their actual values
      for (const tagName in groupedIncludes) {
        groupedIncludes[tagName] = groupedIncludes[tagName].map((include) => {
          for (const [variable, value] of Object.entries(parsed_variables)) {
            include = include.replace(`$(${variable})`, value);
          }
          return include;
        });
      }

      // these are always C# projects, so hardcode the language
      // and put into the required projects structure with a specified "paths" key for each project
      const projects = {
        "csharp": {
          "projects": Object.fromEntries(Object.entries(groupedIncludes).map(
            (include) => {
              const [name, paths] = include;
              return [name, {"paths": paths}];
            }
          )),
        }
      };

      if (core !== undefined) {
        core.setOutput("projects", JSON.stringify(projects));
      } else {
        console.log(JSON.stringify(projects));
      }
    });
  });
}

module.exports = (github, context, core) => {
  return run(github, context, core);
};

function run(github, context, core) {
  const raw_filters = process.env.filters;

  if (!raw_filters) {
    core.setFailed("filters is required");
    return;
  }
  const filters = JSON.parse(raw_filters);
  const changes = JSON.parse(filters.changes);

  const raw_projects = process.env.projects;

  if (!raw_projects) {
    core.setFailed("projects is required");
    return;
  }

  const projects = JSON.parse(raw_projects);

  core.debug("Changes:");
  core.debug(JSON.stringify(changes));
  core.debug("Projects:");
  core.debug(JSON.stringify(projects));

  core.debug(Object.entries(projects));

  const projects_to_scan = {};

  // Filter out projects that don't have changes
  for (const [language, lang_projects] of Object.entries(projects)) {
    core.debug("Language: " + language);
    core.debug("Projects: " + JSON.stringify(lang_projects));

    projects_to_scan[language] = Object.fromEntries(
        Object.entries(lang_projects).filter((project) => {
          const [name, paths] = project;
          core.debug("Project: " + name);
          core.debug("Paths: " + JSON.stringify(paths));
          return changes.includes(name);
        })
    );
  }

  core.debug("Projects to scan:");
  core.debug(JSON.stringify(projects_to_scan));

  const filtered_languages = new Set();
  const filtered_projects = [];

  for (const [language, lang_projects] of Object.entries(projects_to_scan)) {
    core.debug("Language: " + language);
    core.debug("Projects: " + JSON.stringify(lang_projects));

    filtered_languages.add(language);

    for (const [name, paths] of Object.entries(lang_projects)) {
      const project = {
        name: name,
        paths: Array.from(paths),
        sparse_checkout: Array.from(paths).join("\n"),
        codeql_config: "paths:\n  - " + Array.from(paths).join("\n  - "),
        language: language
      };

      filtered_projects.push(project);
    }
  }

  core.debug("Projects list:");
  core.debug(JSON.stringify(filtered_projects));

  const result = {
    projects: Array.from(filtered_projects),
    length: filtered_projects.length,
    languages: Array.from(filtered_languages)
  };

  core.debug("Result:");
  core.debug(JSON.stringify(result));

  return result;
}

module.exports = (github, context, core) => {
  return run(github, context, core);
};

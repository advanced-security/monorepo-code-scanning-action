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

  // Filter out projects that don't have changes
  const projects_to_scan = Object.fromEntries(
    Object.entries(projects).filter((entry) => {
      const [project, _] = entry;
      return changes.includes(project);
    })
  );

  const projects_matrix = Object.fromEntries(
    Object.entries(projects_to_scan).map(([name, paths]) => {
      return [
        name,
        {
          name: name,
          paths: paths,
          sparse_checkout: paths.join("\n"),
          codeql_config: "paths:\n  - " + paths.join("\n  - "),
          languages: ["csharp"] // TODO: don't hardcode this
        },
      ];
    })
  );

  core.debug("Projects matrix:");
  core.debug(JSON.stringify(projects_matrix));

  const result = {
    projects: Object.values(projects_matrix),
    length: Object.keys(projects_matrix).length,
    languages: ["csharp"] // TODO: don't hardcode this
  };

  core.debug("Result:");
  core.debug(JSON.stringify(result));

  return result;
}

module.exports = (github, context, core) => {
  return run(github, context, core);
};

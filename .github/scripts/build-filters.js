const yaml = require("yaml");

function run(github, context, core) {
  const raw_projects = process.env.projects;

  if (!raw_projects) {
    core.setFailed("projects is required");
    return;
  }

  const projects = JSON.parse(raw_projects);

  const filters = {};

  // which filenames to include in the analysis if they are changed, per language
  // TODO: make this configurable (adding new globs) using a file in the repo
  const globs = {
    csharp: ["**/*.cs", "**/*.csproj", "**/*.sln"],
    python: ["**/*.py", "**/pyproject.toml", "**/Pipfile", "**/Pipfile.lock", "**/requirements.txt"],
    go: ["**/*.go", "**/go.mod", "**/go.sum"],
    java: ["**/*.java", "**/*.gradle", "gradle.*", "**/*.kt", "**/*.jar"],
    "java-kotlin": ["**/*.java", "**/*.gradle", "**/*.kt", "**/*.kts", "**/*.jar"],
    "javascript-typescript": ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx", "**/package.json", "**/yarn.lock", "**/package-lock.json"],
    javascript: ["**/*.js", "**/package.json", "**/yarn.lock", "**/package-lock.json"],
    ruby: ["**/*.rb", "**/Gemfile", "**/Gemfile.lock"],
    swift: ["**/*.swift"],
    "c-cpp": ["**/*.c", "**/*.cpp", "**/*.h", "**/*.hpp", "**/*.cc", "**/*.cxx", "**/*.hh", "**/*.hxx", "**/*.c++", "**/*.h++", "**/*.inl"],
  }

  for (const [language, details] of Object.entries(projects)) {
    const globs = globs[language];

    for (const [project, paths] of Object.entries(details)) {
      for (const path of paths) {
        filters[project] ??= [];
        filters[project].push(...globs.map((glob) => `${path}/${glob}`));
      }
    }
  }

  return yaml.stringify(filters);
}

module.exports = (github, context, core) => {
  return run(github, context, core);
};

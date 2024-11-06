const yaml = require("yaml");

function run(github, context, core) {
  const raw_projects = process.env.projects;
  const raw_extra_globs = process.env.extra_globs;

  if (!raw_projects) {
    core.setFailed("projects is required");
    return;
  }

  const projects = JSON.parse(raw_projects);

  core.debug(projects);
  core.debug(typeof projects);
  core.debug(Object.entries(projects));

  const extra_globs = raw_extra_globs != "" ? yaml.parse(raw_extra_globs) : {};

  const filters = {};

  const aliases = {
    java: "java-kotlin",
    kotlin: "java-kotlin",
    javascript: "javascript-typescript",
    typescript: "javascript-typescript",
    c: "c-cpp",
    cpp: "c-cpp",
  };

  // which filenames to include in the analysis if they are changed, per language
  // this is configurable (adding new globs) using an Action input
  const globs = {
    csharp: [
      "**/*.aspx",
      "**/*.cs",
      "**/*.cshtml",
      "**/*.csproj",
      "**/packages.config",
      "**/*.razor",
      "**/*.sln",
      "**/*.xaml",
      "**/*.xml",
    ],
    python: [
      "**/*.py",
      "**/pyproject.toml",
      "**/Pipfile",
      "**/Pipfile.lock",
      "**/requirements.txt",
      "**/requirements-dev.txt",
      "**/requirements.in",
      "**/requirements-dev.in",
      "**/setup.cfg",
    ],
    go: ["**/*.go", "**/go.mod", "**/go.sum"],
    "java-kotlin": [
      "**/*.java",
      "**/*.gradle",
      "**/*.kt",
      "**/*.kts",
      "**/*.jar",
      "**/pom.xml",
    ],
    "javascript-typescript": [
      "**/*.js",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.es",
      "**/*.es6",
      "**/*.ts",
      "**/*.tsx",
      "**/*.mts",
      "**/*.cts",
      "**/*.htm",
      "**/*.html",
      "**/*.xhtm",
      "**/*.xhtml",
      "**/*.vue",
      "**/*.hbs",
      "**/*.ejs",
      "**/*.njk",
      "**/package.json",
      "**/yarn.lock",
      "**/package-lock.json",
      "**/pnpm-lock.yaml",
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "**/*.raml",
      "**/*.xml",
    ],
    ruby: [
      "**/*.rb",
      "**/*.erb",
      "**/Gemfile",
      "**/Gemfile.lock",
      "**/*.gemspec",
    ],
    swift: ["**/*.swift"],
    "c-cpp": [
      "**/*.c",
      "**/*.cpp",
      "**/*.h",
      "**/*.hpp",
      "**/*.cc",
      "**/*.cxx",
      "**/*.hh",
      "**/*.hxx",
      "**/*.c++",
      "**/*.h++",
      "**/*.inl",
      "**/*.pch",
      "**/*.gch",
      "**/configure",
      "**/configure.ac",
      "**/configure.in",
      "**/Makefile",
      "**/makefile",
      "**/Makefile.am",
      "**/makefile.am",
      "**/Makefile.in",
      "**/makefile.in",
      "**/CMakeLists.txt",
      "**/meson.build",
      "**/meson_options.txt",
      "**/BUILD.bazel",
      "**/BUILD",
      "**/.buckconfig",
      "**/BUCK",
      "**/*.ninja",
    ],
  };

  for (const [language, globs] of Object.entries(extra_globs)) {
    const resolved_language = aliases[language] ?? language;
    filters[resolved_language] ??= [];
    filters[resolved_language].push(...globs);
  }

  for (const [language, lang_data] of Object.entries(projects)) {
    const resolved_language = aliases[language] ?? language;

    const lang_globs = globs[resolved_language] ?? ["**/*"];

    const project_entries = lang_data.projects;

    for (const [project, project_data] of Object.entries(project_entries)) {
      for (const path of project_data.paths) {
        filters[project] ??= [];
        const paths_with_globs = lang_globs.map((glob) => `${path}/${glob}`);
        filters[project].push(...paths_with_globs);
      }

      /*
       * we intentionally don't add the top-level files defined in `build-matrix.js` to the filters,
       * nor the individual files for each project in `project_data.files`
       * 
       * This is because these are likely to be shared files that are included in multiple projects,
       * and we don't want to force a re-scan of all projects if a single shared file is changed
       * in a way that affects only one project.
       * 
       * In contrast, we do want to force a re-scan of all projects if a shared *path* is changed,
       * as that is more likely to affect the results of analysis of each project.
       */
    }
  }

  return yaml.stringify(filters);
}

module.exports = (github, context, core) => {
  return run(github, context, core);
};

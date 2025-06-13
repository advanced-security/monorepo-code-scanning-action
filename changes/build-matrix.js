const fs = require('fs');
const yaml = require("yaml");

function run(github, context, core) {
  const build_mode_none_languages = new Set(["csharp", "java", "python", "javascript-typescript", "ruby"]);
  const auto_build_languages = new Set(["go", "java-kotlin", "cpp", "swift"]);
  const allowed_build_modes = new Set(["auto", "autobuild", "none", "manual", "other"]);
  const other_err = 'setting as "other", which requires a fully manual scan with no automatic CodeQL analysis';

  // Note: The CodeQL config filter pattern characters ?, +, [, ], ! are not supported and will be matched literal
  // After extensive testing against JS in April 2015 - I would AVOID {} and [] globs as they are extremely limited support
  const pathIgnoreDefaults = {
    "javascript-typescript": [
      "**/node_modules/**",
      "**/bower_components/**",
      "**/*.min.js",
      "**/*-min.js",
      "**/*.test.js",
      "**/*.test.ts",
      "**/*.test.jsx",
      "**/*.test.tsx",
      "**/*.spec.js",
      "**/*.spec.ts",
      "**/*.spec.jsx",
      "**/*.spec.tsx",
      "**/tests/**",
      "**/jest.config.*",
      "**/jest.setup.*",
      "**/test-utils/**",
      "**/coverage/**",
      "**/CoverageResults/**",
      "**/dist/**",
      "**/3rd-party*/**",
      "**/3rd_party*/**",
      "**/third-party*/**",
      "**/third_party*/**",
      "**/3rd-Party*/**",
      "**/3rd_Party*/**",
      "**/Third-Party*/**",
      "**/Third_Party*/**",
      "**/vendor/**",
      "**/.next/**",
      "**/storybook-static/**",
      "**/__tests__/**",
      "**/__mocks__/**",
      "**/cypress/**",
    ],
    "java-kotlin": [
      "**/target/**",
      "**/build/**",
      "**/out/**",
      "**/test/**",
      "**/.gradle/**",
      "**/3rd-party*/**",
      "**/3rd_party*/**",
      "**/third-party*/**",
      "**/third_party*/**",
      "**/3rd-Party*/**",
      "**/3rd_Party*/**",
      "**/Third-Party*/**",
      "**/Third_Party*/**",
      "**/vendor/**",
      "**/generated/**",
      "**/lib/**",
      "**/libs/**",
      "**/*Test.java",
      "**/*Test.kt",
      "**/*Tests.java",
      "**/*Tests.kt",
      "**/jacoco/**",
      "**/surefire-reports/**",
    ],
    "python": [
      "**/venv/**",
      "**/__pycache__/**",
      "**/test/**",
      "**/tests/**",
      "**/*.pyc",
      "**/.tox/**",
      "**/.pytest_cache/**",
      "**/.coverage/**",
      "**/htmlcov/**",
      "**/3rd-party*/**",
      "**/3rd_party*/**",
      "**/third-party*/**",
      "**/third_party*/**",
      "**/3rd-Party*/**",
      "**/3rd_Party*/**",
      "**/Third-Party*/**",
      "**/Third_Party*/**",
      "**/vendor/**",
      "**/.eggs/**",
      "**/egg-info/**",
      "**/dist/**",
      "**/build/lib/**",
      "**/*_test.py",
      "**/conftest.py",
    ],
    "csharp": [
      "**/bin/**",
      "**/obj/**",
      "**/test/**",
      "**/tests/**",
      "**/wwwroot/lib/**",
      "**/CoverageResults/**",
      "**/TestResults/**",
      "**/3rd-party*/**",
      "**/3rd_party*/**",
      "**/third-party*/**",
      "**/third_party*/**",
      "**/3rd-Party*/**",
      "**/3rd_Party*/**",
      "**/Third-Party*/**",
      "**/Third_Party*/**",
      "**/vendor/**",
      "**/*.test.cs",
      "**/*.tests.cs",
      "**/*.Test.cs",
      "**/*.Tests.cs",
      "**/*Test.cs",
      "**/*Tests.cs",
      "**/packages/**",
      "**/_ReSharper*/**",
      "**/artifacts/**",
      "**/.vs/**",
    ],
    "ruby": [
      "**/vendor/**",
      "**/test/**",
      "**/spec/**",
      "**/3rd-party*/**",
      "**/3rd_party*/**",
      "**/third-party*/**",
      "**/third_party*/**",
      "**/3rd-Party*/**",
      "**/3rd_Party*/**",
      "**/Third-Party*/**",
      "**/Third_Party*/**",
      "**/bundle/**",
      "**/coverage/**",
      "**/.bundle/**",
      "**/tmp/**",
      "**/log/**",
      "**/db/migrate/**",
    ],
    "c-cpp": [
      "**/build/**",
      "**/test/**",
      "**/tests/**",
      "**/*_test.c",
      "**/*_test.cpp",
      "**/*_test.cc",
      "**/*_test.h",
      // Unclear if CPP build mode none would prefer to have these
      // "**/tmp/**",
      // "**/{3rd,Third,third}{_,-}{Party,party}*/**",
      // "**/vendor/**",
      // "**/deps/**",
      // "**/external/**",
      // "**/lib/**",
      // "**/libs/**",
      // "**/unity/**",
      // "**/googletest/**",
    ],
  };

  const top_level_files = {
    "java-kotlin": [
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
      "settings.gradle",
      "settings.gradle.kts",
      "gradle.properties",
      "gradlew",
      "gradlew.bat",
    ],
    "csharp": [
      "*.sln",
      "*.config",
      "*.xml",
      "*.props"
    ],
    "c-cpp": [
      "configure",
      "Makefile",
      "makefile",
      "*.ac",
      "*.in",
      "*.am",
      "CMakeLists.txt",
      "meson.build",
      "meson_options.txt",
      "BUILD.bazel",
      "BUILD",
      ".buckconfig",
      "BUCK",
      "*.ninja",
    ],
  };

  // Update LANGUAGE_ALIASES to map to official identifiers
  const LANGUAGE_ALIASES = {
    c: "c-cpp",
    "c++": "c-cpp",
    cpp: "c-cpp",
    "c#": "csharp",
    java: "java-kotlin",
    kotlin: "java-kotlin",
    typescript: "javascript-typescript",
    javascript: "javascript-typescript",
  };

  // Resolve language alias before processing
  function resolveLanguageAlias(language) {
    return LANGUAGE_ALIASES[language] || language;
  }

  const raw_filters = process.env.filters;
  const raw_projects = process.env.projects;
  const raw_queries = process.env.queries;
  const raw_config = process.env.config;
  const config_file = process.env.config_file;

  if (!raw_projects) {
    core.setFailed("projects is required");
    return;
  }

  const projects = JSON.parse(raw_projects);
  const filters = (raw_filters !== undefined && raw_filters !== "") ? JSON.parse(raw_filters) : undefined;
  const changes = filters !== undefined ? JSON.parse(filters.changes) : [];
  const queries = (raw_queries !== undefined && raw_queries !== "") ? raw_queries.split(",") : null;
  const global_config = (raw_config !== undefined && raw_config !== "") ? yaml.parse(raw_config) : {};

  if (config_file !== undefined && config_file !== "") {
    const config_file_content = fs.readFileSync(config_file, "utf8");
    const config_file_yaml = yaml.parse(config_file_content);
    Object.assign(global_config, config_file_yaml);
  }

  core.debug("Changes:");
  core.debug(JSON.stringify(changes));
  core.debug("Projects:");
  core.debug(JSON.stringify(projects));

  core.debug(Object.entries(projects));

  let projects_to_scan = {};

  // Filter out projects that don't have changes
  for (const [languageKey, lang_data] of Object.entries(projects)) {
    const language = resolveLanguageAlias(languageKey);
    core.debug("Resolved Language: " + language);
    core.debug("Projects: " + JSON.stringify(lang_data.projects));

    projects_to_scan[language] = {};

    projects_to_scan[language]["projects"] = Object.fromEntries(
      Object.entries(lang_data.projects).filter((project) => {
        const [name, project_data] = project;
        core.debug("Project: " + name);
        core.debug("Paths: " + JSON.stringify(project_data.paths));
        return changes.includes(name) || filters === undefined;
      })
    );

    if (lang_data["build-mode"] !== undefined) {
      projects_to_scan[language]["build-mode"] = lang_data["build-mode"];
    }
  }

  core.debug("Projects to scan:");
  core.debug(JSON.stringify(projects_to_scan));

  const filtered_languages = new Set();
  const filtered_projects = [];

  for (const [language, lang_data] of Object.entries(projects_to_scan)) {
    core.debug("Language: " + language);
    core.debug("Filtered projects: " + JSON.stringify(lang_data.projects));

    filtered_languages.add(language);

    const lang_build_mode = lang_data["build-mode"];
    const lang_queries = lang_data.queries;

    for (const [name, project_data] of Object.entries(lang_data.projects)) {
      const project_paths = new Set(project_data.paths);

      // add any individual files to the list of paths to scan
      if (project_data.files !== undefined) {
        project_data.files.forEach(file => project_paths.add(file));
      }

      core.debug(`Project: ${name}, Paths: ${Array.from(project_paths)}`);

      // add the top-level files to the list of paths to scan
      if (top_level_files[language] !== undefined) {
        top_level_files[language].forEach(file => project_paths.add(file));
      }

      let build_mode = project_data["build-mode"] ?? lang_build_mode;
      const project_queries = new Set(project_data.queries ?? lang_queries ?? queries);

      if (build_mode === undefined) {
        // auto-set build-mode depending on the language
        if (build_mode_none_languages.has(language)) {
          build_mode = "none";
        } else if (auto_build_languages.has(language)) {
          build_mode = "autobuild";
        } else {
          core.warning(`No build-mode set for project: ${language}/${name}, ${other_err}`);
          build_mode = "other";
        }
      } else {
        if (!allowed_build_modes.has(build_mode)) {
          core.error(`Invalid build-mode set for project: ${language}/${name}, ${other_err}`);
          build_mode = "other";
        }
      }

      // change 'auto' to 'autobuild' for consistency
      if (build_mode === "auto") {
        build_mode = "autobuild";
      }

      let project_config = global_config;
      Object.assign(project_config, {
        paths: Array.from(project_paths)
      });

      // Apply paths-ignore: use existing if available, otherwise use defaults for the language
      if (!project_config["paths-ignore"] && pathIgnoreDefaults[language]) {
        // The yaml library will handle the quoting, but we need to make sure the strings are preserved as is
        project_config["paths-ignore"] = pathIgnoreDefaults[language];
      } else if (build_mode === "none" && !project_config["paths-ignore"] && !pathIgnoreDefaults[language]) {
        core.warning(`${language} with build-mode: none, paths-ignore filters are recommended here to ignore test/vendored dependencies!`);
      }

      if (project_queries !== null && project_queries.size > 0) {
        project_config.queries = Array.from(project_queries).map((query) => { return { uses: query } })
      }

      const codeql_config_yaml = yaml.stringify(project_config);

      const sparse_checkout_str = Array.from(project_paths).join("\n");

      const project = {
        name: name,
        paths: Array.from(project_paths),
        sparse_checkout: sparse_checkout_str,
        codeql_config: codeql_config_yaml,
        language: language,
        build_mode: build_mode,
      };

      filtered_projects.push(project);
    }
  }

  core.debug("Projects list:");
  core.debug(JSON.stringify(filtered_projects));

  const result = {
    projects: Array.from(filtered_projects),
    length: filtered_projects.length,
    languages: Array.from(filtered_languages),
  };

  core.debug("Result:");
  core.debug(JSON.stringify(result));

  core.debug("Scan required:");
  core.debug(result.length > 0);

  core.setOutput("scan-required", result.length > 0);

  return result;
}

module.exports = (github, context, core) => {
  return run(github, context, core);
};

# Monorepo Code Scanning Action

Focus CodeQL (or other SAST) scans on just the changed parts of your monorepo, split up as you define.

<<<<<<< HEAD
For an example of how to use it, see the `./samples/sample-codeql-monorepo-workflow.yml` in this repository.
=======
## Using the Action

For an example of how to use it, see [`sample-codeql-monorepo-workflow.yml`](./sample-codeql-monorepo-workflow.yml) in this repository.
>>>>>>> origin/main

The steps pass information along to each other to work properly, so you need to use the format defined in that workflow, altering the inputs as required.

### Changes

The `changes` Action looks for changes in your defined project structure.

That structure can either be defined in a JSON file and provided by name in the `project-json` input, or can be parsed out of a C# build XML file in the `build-xml` input.

When using `build-xml` you will need to define any variables used in the input file with concrete values, in a `variables` input, defining them in a YAML format dictionary.

<<<<<<< HEAD
You can see an example of this XML format in this repository in `./samples/build-projects.xml`.
=======
You can see an example of this XML format in this repository in [`build-projects.xml`](./build-projects.xml).
>>>>>>> origin/main

### Scan

The `scan` Action scans any changed projects using CodeQL, using just the changes to the defined projects.

It can use a custom CodeQL scanning workflow to do manual build steps and any required preparation steps before the scanning, which must be located at `.github/workflows/codeql-custom-analysis.yml` in your repository, and activated using the input `custom-analysis: true`.

<<<<<<< HEAD
You can see an example of this custom workflow in this repository in `./samples/codeql-custom-analysis.yml`.

## Replay or republish
=======
This must have conditional checks to apply the correct build steps for the language and project.
>>>>>>> origin/main

### Replay or republish

The `replay-checks` or `republish-sarif` Actions are chosen between to allow the unscanned parts of the project to pass the required CodeQL checks.

Either the SARIF is reublished, or the previous Code Scanning check is replayed. The choice determines whether a complete set of Code Scanning results is attached to the PR, or whether we simply get a passed check without the previous alerts being explicitly provided.

## Tests

Local tests for the scripts this relies on are located in the `tests` folder. They are run with `./run.sh`, vs using a testing framework.

Testing is also done end-to-end using the [`advanced-security/sample-csharp-monorepo`](https://github.com/advanced-security/sample-csharp-monorepo/) repository.

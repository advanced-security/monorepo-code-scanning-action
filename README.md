# Monorepo Code Scanning Action

Focus CodeQL (or other SAST) scans on just the changed parts of your monorepo, split up as you define.

For an example of how to use it, see the `sample-codeql-monorepo-workflow.yml` in this repository.

## Changes

The `changes` Action looks for changes in your defined project structure.

That structure can either be defined in a JSON file and provided by name in the `project-json` input, or can be parsed out of a C# build XML file in the `build-xml` input.

When using `build-xml` you will need to define any variables used in the input file with concrete values, in a `variables` input, defining them in a YAML format dictionary.

## Scan

The `scan` Action scans any changed projects using CodeQL.

## Replay or republish

The `replay-checks` or `republish-sarif` Actions are chosen between to allow the unscanned parts of the project to pass the required CodeQL checks. Either the SARIF is reublished, or the previous Code Scanning check is replayed.

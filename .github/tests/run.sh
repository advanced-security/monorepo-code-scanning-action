#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || exit
cd ..
npm install yaml xml2js @actions/core
cd "$SCRIPT_DIR" || exit

filename=build_projects_dummy.xml variables=$(cat variables.yml) node run-build-projects.js > projects.json
projects=$(cat projects.json) node run-build-filters.js > filters.yml

# assume the filters Action produces the output in `filters_output.json`

filters=$(cat filters_output.json) projects=$(cat projects.json) node run-build-matrix.js > matrix.json

# run the replay checks test
node run-replay-checks.js
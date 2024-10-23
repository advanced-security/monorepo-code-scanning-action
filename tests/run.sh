#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || exit
cd ..
npm install yaml xml2js @actions/core
cd "$SCRIPT_DIR" || exit

filename=build_projects_dummy.xml variables=$(cat variables.yml) node run-build-projects.js > projects.json

echo "Output of build-projects-from-xml.js"
cat projects.json

json_projects=$(sed -n 's/^::set-output name=projects:://p' < projects.json)

projects=$json_projects node run-build-filters.js > filters.yml

echo "Output of build-filters.js"
cat filters.yml

# assume the filters Action produces the output in `filters_output.json`
echo "Assuming output of dorny/path-filter action is in filters_output.json"
cat filters_output.json
echo
echo

filters=$(cat filters_output.json) projects="$json_projects" node run-build-matrix.js > matrix.json

echo "Output of build-matrix.js"
cat matrix.json

# run the republish test
projects=$(cat matrix.json) node run-republish.js

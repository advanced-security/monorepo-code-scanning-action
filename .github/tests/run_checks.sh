#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || exit
cd ..
npm install yaml xml2js @actions/core @octokit/rest
cd "$SCRIPT_DIR" || exit

# run the replay checks test
projects=$(cat projects.json) node run-replay-checks.js
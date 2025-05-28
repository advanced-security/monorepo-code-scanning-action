#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || exit
cd ..
npm install yaml xml2js @actions/core
cd "$SCRIPT_DIR" || exit

export NODE_ENV=dev
export DEBUG='*'

filters=$(cat filters_output.json) projects=$(cat projects.json) node run-build-matrix.js

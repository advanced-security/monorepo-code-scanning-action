const github = undefined;
const context = undefined;
const core = require("@actions/core");

const script = require('../scripts/build-matrix.js')
const result = script(github, context, core);
console.log(result);

const github = undefined;
const context = undefined;
const core = {'debug': input => {}, 'setFailed': input => {}};

const script = require('../changes/build-matrix.js')
const result = script(github, context, core);
console.log(JSON.stringify(result));

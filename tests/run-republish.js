const { Octokit } = require("@octokit/rest");
const core = require("@actions/core");

const github = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const context = {
    repo: {
        owner: 'advanced-security',
        repo: 'monorepo-code-scanning-action'
    },
    payload: {
        pull_request: {
            base: {
                ref: 'main'
            }
        }
    }
}

const script = require('../republish-sarif/republish-sarif.js');
const result = script(github, context, core);

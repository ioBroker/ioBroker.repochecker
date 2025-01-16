'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   GitHub repository
    Numbering   :   800 - 899

*/
const axios = require('axios');

const issuesToWatch = [
    'IMPORTANT: Update of dependency @iobroker/adapter-core is required as soon as possible',
    'Compatibility check and testing for node.js 22',
];

// disable axios caching
axios.defaults.headers = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
};

const common = require('./common.js');

async function getAllIssues(context) {
    //console.log('\ngetAllIssues');
    const response = await axios(`${context.githubUrlApi}/issues`, {});
    return response.data;
}

async function getCommitInfos(context) {
    console.log('\ngetCommitInfos');
    context.lastCommitSha = '';
    context.lastCommitYear = 0;

    let response = {};
    const url = `${context.githubUrlApi}/commits/${context.branch}`;
    try {
        common.debug(`reading github commits from ${url}`);
        response = await axios(url);
    } catch (e) {
        console.log(`[INTERNAL] error downloading commit info from ${url} - ${e}`);
        throw e;
    }

    const lastCommit = response.data;
    //common.debug(`Last commit:\n${JSON.stringify(lastCommit)}`);
    context.lastCommitSha = lastCommit.sha;
    const lastCommitDate = new Date(lastCommit.commit.author.date);
    context.lastCommitYear = lastCommitDate.getUTCFullYear().toString();

    common.debug(`lastCommitSha : ${context.lastCommitSha}`);
    common.debug(`lastCommitYear: ${context.lastCommitYear}`);

    return context;
}

async function checkGithubRepo(context) {
    console.log('\ncheckGithubRepo [E8xx]');

    if (!context.githubApiData.description) {
        context.errors.push(
            `[E801] No repository about text found. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add the description.`,
        );
    } else {
        context.checks.push('Github repository about found.');
    }

    if (!context.githubApiData.topics || context.githubApiData.topics.length === 0) {
        context.errors.push(
            `[E802] No topics found in the repository. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add some topics.`,
        );
    } else {
        context.checks.push('Github repository about found.');
    }

    if (context.githubApiData.archived) {
        context.errors.push(`[E803] Archived repositories are not allowed.`);
    }

    const issues = await getAllIssues(context);
    for (const issue of issues) {
        if (issue.pull_request) {
            continue;
        }
        if (issuesToWatch.includes(issue.title)) {
            context.errors.push(
                `[E804] Please process issue [[#${issue.number}] "${issue.title}"](${context.githubUrlOriginal}/issues/${issue.number})`,
            );
        }
    }

    // max E803 - limited to 849

    return context;
}

exports.getCommitInfos = getCommitInfos;
exports.checkGithubRepo = checkGithubRepo;

// List of error and warnings used at this module
// ----------------------------------------------

// [E801] No repository about text found. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add the description.
// [E802] No topics found in the repository. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add some topics.
// [E803] Archived repositories are not allowed.

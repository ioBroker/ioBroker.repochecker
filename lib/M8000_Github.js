'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   GitHub repository
    Numbering   :   8000 - 8999

*/
const axios = require('axios');

const issuesToWatchAsError = [
    'IMPORTANT: Update of dependency @iobroker/adapter-core is required as soon as possible',
    'Compatibility check and testing for node.js 24',
    'Compatibility check and testing for node.js 22',
    'Compatibility check and testing for Responsive Design (jsonConfig)',
    'Compatibility check and testing for Responsive Design (materialize)',
];

const issuesToWatchAsWarning = [
    'Migration to ESLint 9 and @iobroker/eslint-config',
    'Translations update from ioBroker Translation System',
];

// disable axios caching
axios.defaults.headers.common = {
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
    console.log('[init] getting commit infos');
    context.lastCommitSha = '';
    context.lastCommitYear = 0;

    let response = {};
    const url = `${context.githubUrlApi}/commits/${context.branch}`;
    try {
        common.debug(`reading github commits from ${url}`);
        response = await axios(url);
    } catch (e) {
        common.error(`error downloading commit info from ${url} - ${e}`);
        throw e;
    }

    const lastCommit = response.data;
    //common.debug(`Last commit:\n${JSON.stringify(lastCommit)}`);
    context.lastCommitSha = lastCommit.sha;
    const lastCommitDate = new Date(lastCommit.commit.author.date);
    context.lastCommitYear = lastCommitDate.getUTCFullYear().toString();

    common.debug(`lastCommitSha : ${context.lastCommitSha}`);
    common.debug(`lastCommitYear: ${context.lastCommitYear}`);

    context.checks.push(`Checking based on commit ${context.lastCommitSha}`);
    context.checks.push(`from ${lastCommitDate.toString()}`);
    context.checks.push('');

    return context;
}

async function checkGithubRepo(context) {
    console.log('\n[E8000 - E8999] checkGithubRepo');

    if (!context.githubApiData.description) {
        context.errors.push(
            `[E8001] No repository about text found. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add the description.`,
        );
    } else {
        context.checks.push('Github repository about found.');
    }

    if (!context.githubApiData.topics || context.githubApiData.topics.length === 0) {
        context.errors.push(
            `[E8002] No topics found in the repository. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add some topics.`,
        );
    } else {
        context.checks.push('Github repository about found.');
    }

    if (context.githubApiData.archived) {
        context.errors.push(`[E8003] Archived repositories are not allowed.`);
    }

    const issues = await getAllIssues(context);
    for (const issue of issues) {
        // if (issue.pull_request) {
        //     continue;
        // }
        const type = issue.pull_request ? 'PR' : 'issue';
        if (issuesToWatchAsError.includes(issue.title)) {
            context.errors.push(
                `[E8004] Please process ${type} [[#${issue.number}] "${issue.title}"](${context.githubUrlOriginal}/issues/${issue.number})`,
            );
        } else if (issuesToWatchAsWarning.includes(issue.title)) {
            context.warnings.push(
                `[W8004] Please process ${type} [[#${issue.number}] "${issue.title}"](${context.githubUrlOriginal}/issues/${issue.number})`,
            );
        } else if (issue.title.startsWith('URGENT:')) {
            context.errors.push(
                `[E8004] Please process ${type} [[#${issue.number}] "${issue.title}"](${context.githubUrlOriginal}/issues/${issue.number})`,
            );
        } else if (issue.title.startsWith('IMPORTANT:')) {
            context.warnings.push(
                `[W8004] Please process ${type} [[#${issue.number}] "${issue.title}"](${context.githubUrlOriginal}/issues/${issue.number})`,
            );
        } else if (issue.title.startsWith('[iobroker-bot]')) {
            context.warnings.push(
                `[W8004] Please process ${type} [[#${issue.number}] "${issue.title}"](${context.githubUrlOriginal}/issues/${issue.number})`,
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

// [E8001] No repository about text found. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add the description.
// [E8002] No topics found in the repository. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add some topics.
// [E8003] Archived repositories are not allowed.

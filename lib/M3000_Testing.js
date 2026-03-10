'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Testing
    Numbering   :   3000 - 3099

*/

const common = require('./common.js');

async function checkTests(context) {
    console.log('\n[E3000 - E3999] checking tests');
    // if found some file in `\.github\workflows` with the test inside => it is OK too
    if (
        context &&
        context.filesList.find(
            name =>
                name.startsWith('.github/workflows/') && name.endsWith('.yml') && name.toLowerCase().includes('test'),
        )
    ) {
        context.checks.push('Tests found on github actions');
        return context;
    }

    //    const travisURL = `${context.githubUrlOriginal.replace('github.com', 'api.travis-ci.org')}.png`;
    //
    //    return axios(travisURL)
    //        .then(response => {
    //            if (!response.data) {
    //                context.errors.push('[E3000] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //            if (!response.headers || !response.headers['content-disposition']) {
    //                context.errors.push('[E3000] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //            // inline; filename="passing.png"
    //            const m = response.headers['content-disposition'].match(/filename="(.+)"$/);
    //            if (!m) {
    //                context.errors.push('[E3000] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //
    //            if (m[1] === 'unknown.png') {
    //                context.errors.push('[E3000] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //
    //            context.checks.push('Found on travis-ci');
    //
    //            context.warnings.push('[W3002] Use github actions instead of travis-ci');
    //
    //            if (m[1] !== 'passing.png') {
    //                context.errors.push('[E3001] Tests on Travis-ci.org are broken. Please fix.');
    //            } else {
    //                context.checks.push('Tests are OK on travis-ci');
    //            }
    //
    //            return context;
    //            // max number is E302
    //        });
    // return Promise.resolve(context);

    return context;
}

async function checkDependabotAutomerge(context) {
    console.log('\n[E3001 - S3003] checking dependabot auto-merge workflow');

    // Find all workflow YAML files
    const workflowFiles = context.filesList.filter(
        name => name.includes('.github/workflows/') && (name.endsWith('.yml') || name.endsWith('.yaml')),
    );

    // Check if dependabot config exists
    const hasDependabotConfig = context.filesList.some(
        name =>
            name === '/.github/dependabot.yml' ||
            name === '.github/dependabot.yml' ||
            name === '/.github/dependabot.yaml' ||
            name === '.github/dependabot.yaml',
    );

    let foundDeadAction = false;
    let foundAutomergeAction = false;

    for (const workflowFile of workflowFiles) {
        // Ensure path has a leading slash for getFile
        const filePath = workflowFile.startsWith('/') ? workflowFile : `/${workflowFile}`;
        const content = await common.getFile(context, filePath);

        if (typeof content === 'string' && content) {
            if (content.includes('ahmadnassri/action-dependabot-auto-merge')) {
                foundDeadAction = true;
                context.errors.push(
                    `[E3001] Workflow file "${workflowFile}" uses deprecated "ahmadnassri/action-dependabot-auto-merge" which is no longer working. Please replace it with "iobroker-bot-orga/action-automerge-dependabot@v1".`,
                );
            }
            if (content.includes('iobroker-bot-orga/action-automerge-dependabot')) {
                foundAutomergeAction = true;
            }
        }
    }

    if (!foundDeadAction && !foundAutomergeAction) {
        if (hasDependabotConfig) {
            context.warnings.push(
                '[W3002] Dependabot config (.github/dependabot.yml) found but no auto-merge workflow exists. Consider adding a workflow using "iobroker-bot-orga/action-automerge-dependabot@v1".',
            );
        } else {
            context.warnings.push(
                '[S3003] Consider adding a dependabot auto-merge workflow using "iobroker-bot-orga/action-automerge-dependabot@v1".',
            );
        }
    } else if (!foundDeadAction && foundAutomergeAction) {
        context.checks.push(
            'Dependabot auto-merge workflow using "iobroker-bot-orga/action-automerge-dependabot" found.',
        );
    }

    return context;
}

exports.checkTests = checkTests;
exports.checkDependabotAutomerge = checkDependabotAutomerge;

// List of error and warnings used at this module
// ----------------------------------------------

// [E3001] Workflow file "..." uses deprecated "ahmadnassri/action-dependabot-auto-merge" which is no longer working. Please replace it with "iobroker-bot-orga/action-automerge-dependabot@v1".
// [W3002] Dependabot config (.github/dependabot.yml) found but no auto-merge workflow exists. Consider adding a workflow using "iobroker-bot-orga/action-automerge-dependabot@v1".
// [S3003] Consider adding a dependabot auto-merge workflow using "iobroker-bot-orga/action-automerge-dependabot@v1".

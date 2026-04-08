'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Testing
    Numbering   :   3000 - 3099

*/

const yaml = require('js-yaml');
const common = require('./common.js');

const WORKFLOW_FILE = '/.github/workflows/test-and-release.yml';

/**
 * Returns true if the given file path exists in the context's filesList,
 * handling both the leading-slash (remote) and no-leading-slash (local) formats.
 *
 * @param {object} context - The checker context
 * @param {string} filePath - File path with leading slash (e.g. '/.github/workflows/test-and-release.yml')
 * @returns {boolean} true if file is found in filesList
 */
function fileExistsInList(context, filePath) {
    if (!context.filesList) {
        return false;
    }
    // remote mode: paths have leading slash; local mode: paths don't have leading slash
    return context.filesList.includes(filePath) || context.filesList.includes(filePath.replace(/^\//, ''));
}

/**
 * Returns true if any step in a job uses the given action (prefix match).
 *
 * @param {object} job - A GitHub Actions job object
 * @param {string} actionPrefix - The action name prefix to look for (e.g. 'ioBroker/testing-action-check@')
 * @returns {boolean} true if a matching step is found
 */
function jobHasStepWithAction(job, actionPrefix) {
    if (!job || !Array.isArray(job.steps)) {
        return false;
    }
    return job.steps.some(step => typeof step.uses === 'string' && step.uses.startsWith(actionPrefix));
}

/**
 * Returns true if the given job declares that it needs all of the specified jobs.
 *
 * @param {object} job - A GitHub Actions job object
 * @param {string[]} requiredJobs - Job names that must be listed in job.needs
 * @returns {boolean} true if all required jobs are listed in needs
 */
function jobNeedsAll(job, requiredJobs) {
    if (!job) {
        return false;
    }
    if (requiredJobs.length === 0) {
        return true;
    }
    const needs = job.needs;
    if (!needs) {
        return false;
    }
    const needsArr = Array.isArray(needs) ? needs : [needs];
    return requiredJobs.every(req => needsArr.includes(req));
}

/**
 * Returns true if the job identified by `startJobName` depends on `requiredJobName`
 * either directly or transitively through the needs chain.
 *
 * @param {object} jobs - All jobs in the workflow (map of job name -> job object)
 * @param {string} startJobName - The job to start the search from
 * @param {string} requiredJobName - The job name that must be reachable via needs
 * @returns {boolean} true if requiredJobName is a direct or transitive dependency of startJobName
 */
function jobDependsOn(jobs, startJobName, requiredJobName) {
    const visited = new Set();
    const queue = [startJobName];
    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) {
            continue;
        }
        visited.add(current);
        const job = jobs[current];
        if (!job || !job.needs) {
            continue;
        }
        const needsArr = Array.isArray(job.needs) ? job.needs : [job.needs];
        if (needsArr.includes(requiredJobName)) {
            return true;
        }
        for (const dep of needsArr) {
            if (!visited.has(dep)) {
                queue.push(dep);
            }
        }
    }
    return false;
}

async function checkTests(context) {
    console.log('\n[E3000 - E3999] checking tests');

    // --- E3000: check for testing devDependency ---
    const devDeps = (context.packageJson && context.packageJson.devDependencies) || {};
    const hasTesting = Object.prototype.hasOwnProperty.call(devDeps, '@iobroker/testing');
    const hasLegacyTesting = Object.prototype.hasOwnProperty.call(devDeps, '@iobroker/legacy-testing');

    if (!hasTesting && !hasLegacyTesting) {
        if (!context.cfg.onlyWWW) {
            context.errors.push(
                '[E3000] Neither "@iobroker/testing" nor "@iobroker/legacy-testing" is listed as a devDependency in package.json. Please add one of them.',
            );
        } else {
            context.checks.push('Testing devDependency check skipped (onlyWWW adapter).');
        }
    }

    if (!hasTesting && hasLegacyTesting) {
        context.warnings.push(
            '[S3001] "@iobroker/legacy-testing" is used. Consider migrating to "@iobroker/testing" for better support.',
        );
        // Skip further workflow checks for legacy-testing adapters
        return context;
    }

    // --- E3002: check that test-and-release.yml exists ---
    if (!fileExistsInList(context, WORKFLOW_FILE)) {
        context.errors.push(
            `[E3002] Workflow file "${WORKFLOW_FILE}" not found. Please create it for standard CI/CD testing.`,
        );
        return context;
    }

    context.checks.push(`Workflow file "${WORKFLOW_FILE}" found.`);

    // --- Load the workflow file ---
    let workflowContent;
    try {
        workflowContent = await common.getFile(context, WORKFLOW_FILE);
    } catch (e) {
        context.errors.push(`[E3003] Could not read workflow file "${WORKFLOW_FILE}": ${e}`);
        return context;
    }

    if (!workflowContent) {
        context.errors.push(`[E3003] Workflow file "${WORKFLOW_FILE}" is empty or could not be read.`);
        return context;
    }

    // --- E3003: validate workflow YAML ---
    let workflow;
    try {
        workflow = yaml.load(workflowContent);
    } catch (e) {
        context.errors.push(`[E3003] Workflow file "${WORKFLOW_FILE}" is not valid YAML: ${e.message.split('\n')[0]}`);
        return context;
    }

    if (!workflow || typeof workflow !== 'object') {
        context.errors.push(`[E3003] Workflow file "${WORKFLOW_FILE}" does not contain valid workflow content.`);
        return context;
    }

    context.checks.push(`Workflow file "${WORKFLOW_FILE}" is valid YAML.`);

    // --- W3004: check workflow name ---
    if (workflow.name !== 'Test and Release') {
        context.warnings.push(
            `[W3004] Workflow "name" in "${WORKFLOW_FILE}" must be "Test and Release" (found: "${workflow.name || '(not set)'}" ).`,
        );
    } else {
        context.checks.push('Workflow name is "Test and Release".');
    }

    // --- Check the 'on' attribute ---
    const onAttr = workflow['on'] || workflow.on;

    // --- W3005: check for pull_request in 'on' ---
    if (!onAttr || !Object.prototype.hasOwnProperty.call(onAttr, 'pull_request')) {
        context.warnings.push(
            `[W3005] Workflow "${WORKFLOW_FILE}" should have "pull_request: {}" in the "on" trigger configuration.`,
        );
    } else {
        context.checks.push('Workflow trigger includes "pull_request".');
    }

    // --- E3006 / E3007 / E3008: check for push in 'on' ---
    if (!onAttr || !Object.prototype.hasOwnProperty.call(onAttr, 'push')) {
        context.errors.push(
            `[E3006] Workflow "${WORKFLOW_FILE}" is missing the "push" trigger in the "on" configuration.`,
        );
    } else {
        context.checks.push('Workflow trigger includes "push".');

        const pushConfig = onAttr.push || {};

        // E3007: check push branches
        const branches = pushConfig.branches;
        if (!branches || !Array.isArray(branches) || branches.length === 0) {
            context.errors.push(
                `[E3007] Workflow "${WORKFLOW_FILE}": "push" trigger is missing "branches" configuration. ` +
                    `Must include "*" or the default branch ("${context.branch}").`,
            );
        } else {
            const defaultBranch = context.branch || 'unknown';
            const hasWildcard = branches.includes('*');
            const hasDefaultBranch = branches.includes(defaultBranch);
            if (!hasWildcard && !hasDefaultBranch) {
                context.errors.push(
                    `[E3007] Workflow "${WORKFLOW_FILE}": "push" trigger "branches" must include "*" or the default branch "${defaultBranch}". ` +
                        `Found: ${JSON.stringify(branches)}`,
                );
            } else {
                context.checks.push('Workflow "push" trigger branches are correctly configured.');
            }
        }

        // E3008: check push tags
        const tags = pushConfig.tags;
        const requiredTagPatterns = ['v[0-9]+.[0-9]+.[0-9]+', 'v[0-9]+.[0-9]+.[0-9]+-**'];
        if (!tags || !Array.isArray(tags)) {
            context.errors.push(
                `[E3008] Workflow "${WORKFLOW_FILE}": "push" trigger is missing "tags" configuration. ` +
                    `Required tag patterns: ${requiredTagPatterns.join(', ')}`,
            );
        } else {
            const cleanedTags = pushConfig.tags.map(tag => tag.replaceAll('v?', 'v'));
            const missingPatterns = requiredTagPatterns.filter(pat => !cleanedTags.includes(pat));
            if (missingPatterns.length > 0) {
                context.errors.push(
                    `[E3008] Workflow "${WORKFLOW_FILE}": "push" trigger "tags" is missing required pattern(s): ${missingPatterns.join(', ')}`,
                );
            } else {
                context.checks.push('Workflow "push" trigger tags are correctly configured.');
            }
        }
    }

    // --- W3009: check concurrency ---
    const concurrency = workflow.concurrency;
    if (!concurrency || concurrency.group !== '${{ github.ref }}' || concurrency['cancel-in-progress'] !== true) {
        context.warnings.push(
            `[W3009] Workflow "${WORKFLOW_FILE}" is missing recommended concurrency configuration. See ` +
                `"https://github.com/ioBroker/ioBroker.example/blob/e7db900495bb3c2b89dc35d863dda4ccf33f5def/JavaScript/.github/workflows/test-and-release.yml#L17" for details.`,
        );
    } else {
        context.checks.push('Workflow concurrency configuration is correct.');
    }

    // skip detailled tests if adapter uses legacy testing
    if (!hasLegacyTesting) {
        // --- Check jobs ---
        const jobs = workflow.jobs || {};

        // E3010: check-and-lint job
        if (!jobs['check-and-lint']) {
            if (!context.cfg.onlyWWW) {
                context.errors.push(
                    `[E3010] Workflow "${WORKFLOW_FILE}": job "check-and-lint" is missing. Please add it.`,
                );
            } else {
                context.warnings.push(
                    `[S3010] Workflow "${WORKFLOW_FILE}": job "check-and-lint" is missing. Consider adding it.`,
                );
            }
        } else {
            context.checks.push('Job "check-and-lint" found.');

            // W3013: check-and-lint must use ioBroker/testing-action-check@v1
            if (!jobHasStepWithAction(jobs['check-and-lint'], 'ioBroker/testing-action-check@')) {
                context.warnings.push(
                    `[W3013] Workflow "${WORKFLOW_FILE}": job "check-and-lint" should contain a step using "ioBroker/testing-action-check@v1".`,
                );
            } else {
                context.checks.push('Job "check-and-lint" uses "ioBroker/testing-action-check@v1".');
            }
        }

        // E3011: adapter-tests job
        if (context.cfg.onlyWWW) {
            context.checks.push('Job "adapter-tests" check skipped (onlyWWW adapter).');
        } else if (!jobs['adapter-tests']) {
            context.errors.push(`[E3011] Workflow "${WORKFLOW_FILE}": job "adapter-tests" is missing. Please add it.`);
        } else {
            context.checks.push('Job "adapter-tests" found.');

            // S3014: adapter-tests should need check-and-lint
            if (!jobNeedsAll(jobs['adapter-tests'], ['check-and-lint'])) {
                context.warnings.push(
                    `[S3014] Workflow "${WORKFLOW_FILE}": job "adapter-tests" should declare "needs: check-and-lint" to run after linting.`,
                );
            } else {
                context.checks.push('Job "adapter-tests" correctly requires "check-and-lint".');
            }

            // W3015: adapter-tests must use ioBroker/testing-action-adapter@v1
            if (!jobHasStepWithAction(jobs['adapter-tests'], 'ioBroker/testing-action-adapter@')) {
                context.warnings.push(
                    `[W3015] Workflow "${WORKFLOW_FILE}": job "adapter-tests" should contain a step using "ioBroker/testing-action-adapter@v1".`,
                );
            } else {
                context.checks.push('Job "adapter-tests" uses "ioBroker/testing-action-adapter@v1".');
            }
        }

        // S3012: deploy job (suggestion if missing)
        if (!jobs['deploy']) {
            context.warnings.push(
                `[S3012] Workflow "${WORKFLOW_FILE}": job "deploy" is not defined. Consider adding it for automated releases.`,
            );
        } else {
            context.checks.push('Job "deploy" found.');

            // E3016: deploy must depend (directly or transitively) on check-and-lint and adapter-tests,
            // but only if those jobs exist in the workflow
            const requiredDependencies = ['check-and-lint', 'adapter-tests'].filter(j => jobs[j]);
            if (!requiredDependencies.every(req => jobDependsOn(jobs, 'deploy', req))) {
                context.errors.push(
                    `[E3016] Workflow "${WORKFLOW_FILE}": job "deploy" must declare "needs" for both "check-and-lint" and "adapter-tests".`,
                );
            } else {
                context.checks.push('Job "deploy" correctly requires "check-and-lint" and "adapter-tests".');
            }

            // W3017: deploy must use ioBroker/testing-action-deploy@v1
            if (!jobHasStepWithAction(jobs['deploy'], 'ioBroker/testing-action-deploy@')) {
                context.warnings.push(
                    `[W3017] Workflow "${WORKFLOW_FILE}": job "deploy" should contain a step using "ioBroker/testing-action-deploy@v1".`,
                );
            } else {
                context.checks.push('Job "deploy" uses "ioBroker/testing-action-deploy@v1".');

                // W3018: check trusted publishing permissions at job level
                const permissions = jobs['deploy'].permissions;
                const hasContentsWrite = permissions && permissions.contents === 'write';
                const hasIdTokenWrite = permissions && permissions['id-token'] === 'write';
                if (!hasContentsWrite || !hasIdTokenWrite) {
                    context.warnings.push(
                        `[W3018] Workflow "${WORKFLOW_FILE}": job "deploy" is missing required permissions "contents: write" and "id-token: write" at job level. ` +
                            `Trusted publishing will not work without them.`,
                    );
                } else {
                    context.checks.push(
                        'Job "deploy" has required trusted publishing permissions (contents: write, id-token: write).',
                    );
                }

                // W3019: check that npm-token is not specified in the deploy action step
                const deployStep = jobs['deploy'].steps.find(
                    step => typeof step.uses === 'string' && step.uses.startsWith('ioBroker/testing-action-deploy@'),
                );
                if (
                    deployStep &&
                    deployStep.with &&
                    Object.prototype.hasOwnProperty.call(deployStep.with, 'npm-token')
                ) {
                    context.warnings.push(
                        `[W3019] Workflow "${WORKFLOW_FILE}": job "deploy" step using "ioBroker/testing-action-deploy@v1" ` +
                            `has "npm-token" parameter specified. ` +
                            `Trusted publishing will not work while "npm-token" is set.`,
                    );
                } else {
                    context.checks.push('Job "deploy" step does not use "npm-token" (trusted publishing compatible).');
                }
            }
        }
    }

    return context;
}

exports.checkTests = checkTests;

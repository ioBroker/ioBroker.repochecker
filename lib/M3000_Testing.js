'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Testing
    Numbering   :   3000 - 3099

*/

const axios = require('axios');
const compareVersions = require('compare-versions');
const yaml = require('js-yaml');
const semverMajor = require('semver/functions/major');
const common = require('./common.js');
const config = require('./config.js');

const WORKFLOW_FILE = '/.github/workflows/test-and-release.yml';
const WORKFLOW_FILE_SHORT = 'test-and-release.yml';

function normalizeVersion(version) {
    return typeof version === 'string' ? version.trim().replace(/^v/, '') : '';
}

function getVersionTagCandidates(version) {
    const normalizedVersion = normalizeVersion(version);
    if (!normalizedVersion) {
        return [];
    }
    return [`v${normalizedVersion}`, normalizedVersion];
}

function findTagNameForVersion(tags, version) {
    if (!Array.isArray(tags)) {
        return '';
    }
    const candidates = getVersionTagCandidates(version);
    const foundTag = tags.find(tag => tag && typeof tag.name === 'string' && candidates.includes(tag.name));
    return foundTag ? foundTag.name : '';
}

function formatRunLink(run) {
    return `[run #${run.run_number}](${run.html_url})`;
}

function getNewestNpmVersion(npmPackageData) {
    const versions = npmPackageData && npmPackageData.versions ? Object.keys(npmPackageData.versions) : [];
    if (versions.length === 0) {
        return '';
    }
    let newestVersion = '';
    for (const version of versions) {
        if (!newestVersion || compareVersions.compare(version, newestVersion, '>')) {
            newestVersion = version;
        }
    }
    return newestVersion;
}

function findTagTriggeredRun(workflowRuns, version, taggedVersion) {
    if (!Array.isArray(workflowRuns)) {
        return null;
    }
    const branchCandidates = new Set([taggedVersion, ...getVersionTagCandidates(version)]);
    return (
        workflowRuns.find(
            run => run.event === 'push' && run.head_branch && branchCandidates.has(run.head_branch) && run.html_url,
        ) || null
    );
}

function checkTagTriggeredRun(context, workflowRuns, version, taggedVersion, codeBase, sourceLabel) {
    const tagRun = findTagTriggeredRun(workflowRuns, version, taggedVersion);
    if (!tagRun) {
        context.warnings.push(
            `[S${codeBase}] No workflow run for "${WORKFLOW_FILE_SHORT}" triggered by tag "${taggedVersion}" was found for ${sourceLabel}. ` +
                `Workflow logs might be deleted already.`,
        );
        return;
    }

    if (tagRun.conclusion === 'cancelled') {
        context.warnings.push(
            `[W${codeBase}] Workflow "${WORKFLOW_FILE_SHORT}" run triggered by tag "${taggedVersion}" for ${sourceLabel} was cancelled ${formatRunLink(tagRun)}.`,
        );
    } else if (tagRun.conclusion === 'failure') {
        context.errors.push(
            `[W${codeBase}] Workflow "${WORKFLOW_FILE_SHORT}" run triggered by tag "${taggedVersion}" for ${sourceLabel} failed ${formatRunLink(tagRun)}.`,
        );
    } else {
        context.checks.push(
            `Workflow "${WORKFLOW_FILE_SHORT}" run triggered by tag "${taggedVersion}" for ${sourceLabel} finished with conclusion "${tagRun.conclusion}" ${formatRunLink(tagRun)}.`,
        );
        common.info(
            `Workflow "${WORKFLOW_FILE_SHORT}" run triggered by tag "${taggedVersion}" for ${sourceLabel} finished with conclusion "${tagRun.conclusion}" ${formatRunLink(tagRun)}.`,
        );
    }
}

/**
 * Returns true if the given file path exists in the context's filesList,
 * handling both the leading-slash (remote) and no-leading-slash (local) formats.
 *
 * @param {object} context - The checker context
 * @param {string} filePath - File path with leading slash (e.g. '/.github/workflows/test-and-releachecse.yml')
 * @returns {boolean} true if file is found in filesList
 */
function fileExistsInList(context, filePath) {
    if (!context.filesList) {
        throw new Error('FATAL: context.filesList is undefined');
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
 * Returns all action refs (part after "@", e.g. v1/main/sha) used by a job for the given action prefix.
 *
 * @param {object} job - A GitHub Actions job object
 * @param {string} actionPrefix - The action name prefix to look for (e.g. 'ioBroker/testing-action-check@')
 * @returns {string[]} Array of refs used for the action in this job
 */
function getJobActionRefs(job, actionPrefix) {
    if (!job || !Array.isArray(job.steps)) {
        return [];
    }
    return job.steps
        .map(step => (typeof step.uses === 'string' ? step.uses : ''))
        .filter(uses => uses.startsWith(actionPrefix))
        .map(uses => uses.slice(actionPrefix.length).trim())
        .filter(Boolean);
}

function jobHasStepWithActionInputValue(job, actionPrefix, inputName, expectedValue) {
    if (!job || !Array.isArray(job.steps)) {
        return false;
    }
    return job.steps.some(step => {
        if (typeof step.uses !== 'string' || !step.uses.startsWith(actionPrefix) || !step.with) {
            return false;
        }
        const value = step.with[inputName];
        if (typeof expectedValue === 'boolean') {
            return (
                value === expectedValue || (typeof value === 'string' && value.toLowerCase() === String(expectedValue))
            );
        }
        return value === expectedValue;
    });
}

/**
 * Parses the major version from an action ref string.
 * Supports values like "v1", "1", "v2.3.4". Returns null for non-numeric refs like branch names.
 *
 * @param {string} ref - Action ref string
 * @returns {number|null} Major version or null if not parseable
 */
function parseActionMajorVersion(ref) {
    if (typeof ref !== 'string') {
        return null;
    }
    const match = ref.trim().match(/^v?(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Returns true if the given action ref is an overly specific version reference
 * (e.g., "v2.0" or "v2.0.0") rather than just a major version (e.g., "v2").
 * Only returns true for numeric version refs with a minor or patch component.
 *
 * @param {string} ref - Action ref string
 * @returns {boolean} true if the ref pins a specific minor/patch version
 */
function isOverlySpecificVersionRef(ref) {
    if (typeof ref !== 'string') {
        return false;
    }
    return /^v?\d+\.\d/.test(ref.trim());
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

/**
 * Parses the major version number from a node.js version string.
 * Handles formats like '20', '20.x', '20.1.2', 'lts/*' (returns null for lts).
 *
 * @param {string|number} versionStr - The version string to parse
 * @returns {number|null} The major version number, or null if not parseable
 */
function parseNodeMajor(versionStr) {
    if (versionStr === undefined || versionStr === null) {
        return null;
    }
    const match = String(versionStr).match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Returns the node.js major version number used in a non-matrix job,
 * by scanning all steps for a 'node-version' in their 'with' parameters.
 *
 * @param {object} job - A GitHub Actions job object
 * @returns {number|null} The major node.js version, or null if not found
 */
function getJobNodeMajorVersion(job) {
    if (!job || !Array.isArray(job.steps)) {
        return null;
    }
    for (const step of job.steps) {
        if (typeof step.uses === 'string' && step.with) {
            const nodeVersion = step.with['node-version'];
            if (nodeVersion !== undefined && nodeVersion !== null) {
                const major = parseNodeMajor(nodeVersion);
                if (major !== null) {
                    return major;
                }
            }
        }
    }
    return null;
}

/**
 * Returns an array of major node.js version numbers from a job's strategy matrix
 * (matrix.node-version or matrix.node).
 *
 * @param {object} job - A GitHub Actions job object
 * @returns {number[]} Array of major version numbers found in the matrix
 */
function getMatrixNodeMajorVersions(job) {
    if (!job || !job.strategy || !job.strategy.matrix) {
        return [];
    }
    const matrix = job.strategy.matrix;
    const nodeVersions = matrix['node-version'] || matrix.node;
    if (!Array.isArray(nodeVersions)) {
        return [];
    }
    return nodeVersions.map(v => parseNodeMajor(v)).filter(v => v !== null);
}

/**
 * Returns an array of OS strings from a job's strategy matrix (matrix.os or matrix['runs-on']).
 *
 * @param {object} job - A GitHub Actions job object
 * @returns {string[]} Array of OS strings found in the matrix
 */
function getMatrixOs(job) {
    if (!job || !job.strategy || !job.strategy.matrix) {
        return [];
    }
    const matrix = job.strategy.matrix;
    const os = matrix.os || matrix['runs-on'];
    if (!os) {
        return [];
    }
    if (!Array.isArray(os)) {
        return typeof os === 'string' ? [os] : [];
    }
    return os;
}

/**
 * Returns OS entries from all steps that use the adapter testing action.
 *
 * @param {object} job - A GitHub Actions job object
 * @param {string} actionPrefix - Action prefix (e.g. ioBroker/testing-action-adapter@)
 * @returns {string[]} Array of OS entries from action step "with.os" or "with.runs-on"
 */
function getAdapterActionStepOs(job, actionPrefix) {
    if (!job || !Array.isArray(job.steps)) {
        return [];
    }

    return job.steps
        .filter(step => typeof step.uses === 'string' && step.uses.startsWith(actionPrefix))
        .flatMap(step => {
            const os = step.with && (step.with.os || step.with['runs-on']);
            if (!os) {
                return [];
            }
            if (Array.isArray(os)) {
                return os.filter(v => typeof v === 'string');
            }
            if (typeof os === 'string') {
                return os
                    .split(',')
                    .map(v => v.trim())
                    .filter(Boolean);
            }
            return [];
        });
}

/**
 * Maps a workflow/package OS entry to a normalized required OS system.
 *
 * @param {string} osEntry - OS entry value from workflow matrix or package.json
 * @param {object} aliasMap - Map of alias -> normalized system
 * @returns {string|null} Normalized OS system ("ubuntu", "windows", "macos") or null
 */
function normalizeOsSystem(osEntry, aliasMap) {
    if (typeof osEntry !== 'string') {
        return null;
    }
    const normalized = osEntry.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    if (aliasMap[normalized]) {
        return aliasMap[normalized];
    }
    const base = normalized.split('-')[0];
    return aliasMap[base] || null;
}

/**
 * Returns a normalized list of tested systems from workflow OS values.
 *
 * @param {string[]} osValues - Raw OS values from workflow
 * @param {object} aliasMap - Map of alias -> normalized system
 * @returns {string[]} Unique normalized systems
 */
function normalizeWorkflowOsSystems(osValues, aliasMap) {
    const systems = new Set();
    for (const osValue of osValues) {
        const system = normalizeOsSystem(osValue, aliasMap);
        if (system) {
            systems.add(system);
        }
    }
    return [...systems];
}

/**
 * Returns allowed required OS systems inferred from package.json os clause.
 *
 * @param {string|string[]|undefined} osClause - package.json "os" value
 * @param {string[]} requiredSystems - required workflow systems
 * @param {object} packageOsAliasMap - map of package.json os aliases
 * @returns {Set<string>} Allowed required systems
 */
function getAllowedRequiredOsSystems(osClause, requiredSystems, packageOsAliasMap) {
    const required = new Set(requiredSystems);
    if (!osClause) {
        return new Set(requiredSystems);
    }

    const clauseEntries = Array.isArray(osClause) ? osClause : [osClause];
    const positive = new Set();
    const negative = new Set();

    for (const rawEntry of clauseEntries) {
        if (typeof rawEntry !== 'string') {
            continue;
        }
        const entry = rawEntry.trim().toLowerCase();
        if (!entry) {
            continue;
        }
        const isNegative = entry.startsWith('!');
        const key = isNegative ? entry.slice(1) : entry;
        const system = packageOsAliasMap[key] || null;
        if (!system || !required.has(system)) {
            continue;
        }
        if (isNegative) {
            negative.add(system);
        } else {
            positive.add(system);
        }
    }

    const allowed = positive.size > 0 ? new Set(positive) : new Set(requiredSystems);
    for (const system of negative) {
        allowed.delete(system);
    }
    return allowed;
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
            `[W3004] Workflow "name" in "${WORKFLOW_FILE_SHORT}" must be "Test and Release" (found: "${workflow.name || '(not set)'}" ).`,
        );
    } else {
        context.checks.push('Workflow name is "Test and Release".');
    }

    // --- Check the 'on' attribute ---
    const onAttr = workflow['on'] || workflow.on;

    // --- W3005: check for pull_request in 'on' ---
    if (!onAttr || !Object.prototype.hasOwnProperty.call(onAttr, 'pull_request')) {
        context.warnings.push(
            `[W3005] Workflow "${WORKFLOW_FILE_SHORT}" should have "pull_request: {}" in the "on" trigger configuration.`,
        );
    } else {
        context.checks.push('Workflow trigger includes "pull_request".');
    }

    // --- E3006 / E3007 / E3008: check for push in 'on' ---
    if (!onAttr || !Object.prototype.hasOwnProperty.call(onAttr, 'push')) {
        context.errors.push(
            `[E3006] Workflow "${WORKFLOW_FILE_SHORT}" is missing the "push" trigger in the "on" configuration.`,
        );
    } else {
        context.checks.push('Workflow trigger includes "push".');

        const pushConfig = onAttr.push || {};

        // E3007: check push branches
        const branches = pushConfig.branches;
        if (!branches || !Array.isArray(branches) || branches.length === 0) {
            context.errors.push(
                `[E3007] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger is missing "branches" configuration. ` +
                    `Must include "*" or the default branch ("${context.branch}").`,
            );
        } else {
            const defaultBranch = context.branch || 'unknown';
            const hasWildcard = branches.includes('*');
            const hasDefaultBranch = branches.includes(defaultBranch);
            if (!hasWildcard && !hasDefaultBranch) {
                context.errors.push(
                    `[E3037] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger "branches" must include "*" or the default branch "${defaultBranch}". ` +
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
                `[E3008] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger is missing "tags" configuration. ` +
                    `Required tag patterns: ${requiredTagPatterns.join(', ')}`,
            );
        } else {
            const cleanedTags = pushConfig.tags.map(tag => tag.replaceAll('v?', 'v'));
            const missingPatterns = requiredTagPatterns.filter(pat => !cleanedTags.includes(pat));
            if (missingPatterns.length > 0) {
                context.errors.push(
                    `[E3040] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger "tags" is missing required pattern(s): ${missingPatterns.join(', ')}`,
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
            `[W3009] Workflow "${WORKFLOW_FILE_SHORT}" is missing recommended concurrency configuration. See ` +
                `"https://github.com/ioBroker/ioBroker.example/blob/e7db900495bb3c2b89dc35d863dda4ccf33f5def/JavaScript/.github/workflows/test-and-release.yml#L17" for details.`,
        );
    } else {
        context.checks.push('Workflow concurrency configuration is correct.');
    }

    // --- check runs ---
    try {
        const defaultBranch = context.branch || 'main';
        const workflowRunsResponse = await axios(
            `${context.githubUrlApi}/actions/workflows/${WORKFLOW_FILE_SHORT}/runs?per_page=100&branch=${encodeURIComponent(defaultBranch)}`,
        );
        const workflowRuns = workflowRunsResponse.data && workflowRunsResponse.data.workflow_runs;
        if (!Array.isArray(workflowRuns) || workflowRuns.length === 0) {
            const workflowUrl = `${context.githubUrlOriginal}/actions/workflows/${WORKFLOW_FILE_SHORT}`;
            context.warnings.push(
                `[W3031] No workflow runs found for "${WORKFLOW_FILE_SHORT}". Please check [${workflowUrl}](${workflowUrl}).`,
            );
        } else {
            const lastRun = workflowRuns[0];
            if (lastRun.conclusion === 'cancelled') {
                context.warnings.push(
                    `[W3041] Latest workflow run of "${WORKFLOW_FILE_SHORT}" on branch "${defaultBranch}" was cancelled ${formatRunLink(lastRun)}.`,
                );
            } else if (lastRun.conclusion === 'failure') {
                context.errors.push(
                    `[E3031] Latest workflow run of "${WORKFLOW_FILE_SHORT}" on branch "${defaultBranch}" failed ${formatRunLink(lastRun)}.`,
                );
            } else {
                context.checks.push(
                    `Latest workflow run of "${WORKFLOW_FILE_SHORT}" on branch "${defaultBranch}" finished with conclusion "${lastRun.conclusion}" ${formatRunLink(lastRun)}.`,
                );
            }

            const tagsResponse = await axios(`${context.githubUrlApi}/tags?per_page=100`);
            const tags = Array.isArray(tagsResponse.data) ? tagsResponse.data : [];

            const currentRelease =
                (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.version) ||
                (context.packageJson && context.packageJson.version) ||
                '';

            if (currentRelease) {
                const currentReleaseTag = findTagNameForVersion(tags, currentRelease);
                if (!currentReleaseTag) {
                    context.warnings.push(
                        `[W3032] Release ${currentRelease} from io-package.json/package.json has not yet been tagged. Tagging releases is required.`,
                    );
                } else {
                    checkTagTriggeredRun(
                        context,
                        workflowRuns,
                        currentRelease,
                        currentReleaseTag,
                        '3032',
                        `current release ${currentRelease}`,
                    );
                }
            }

            try {
                const adapterName = typeof context.adapterName === 'string' ? context.adapterName : '';
                if (!/^[a-z0-9][a-z0-9._-]*$/i.test(adapterName)) {
                    context.warnings.push(
                        `[W3033] Could not validate npm release information because adapter name "${adapterName}" is not in a valid npm package name format.`,
                    );
                } else {
                    const npmPackageName = `iobroker.${adapterName}`;
                    const npmResponse = await axios(`https://registry.npmjs.org/${npmPackageName}`);
                    const npmPackageData = npmResponse.data || {};
                    const npmLatestRelease = npmPackageData['dist-tags'] && npmPackageData['dist-tags'].latest;
                    // if (npmLatestRelease) {
                    if (npmLatestRelease && npmLatestRelease !== currentRelease) {
                        const npmLatestTag = findTagNameForVersion(tags, npmLatestRelease);
                        if (!npmLatestTag) {
                            context.errors.push(
                                `[E3034] Release ${npmLatestRelease} tagged as "latest" at npm has not yet been tagged at GitHub. Tagging of releases is required.`,
                            );
                        } else {
                            checkTagTriggeredRun(
                                context,
                                workflowRuns,
                                npmLatestRelease,
                                npmLatestTag,
                                '3035',
                                `npm latest release ${npmLatestRelease}`,
                            );
                        }
                    }

                    const newestNpmRelease = getNewestNpmVersion(npmPackageData);
                    if (newestNpmRelease && newestNpmRelease !== npmLatestRelease) {
                        const newestNpmTag = findTagNameForVersion(tags, newestNpmRelease);
                        if (!newestNpmTag) {
                            context.errors.push(
                                `[E3036] Newest npm release ${newestNpmRelease} has not yet been tagged at GitHub. Tagging of releases is required.`,
                            );
                        } else {
                            checkTagTriggeredRun(
                                context,
                                workflowRuns,
                                newestNpmRelease,
                                newestNpmTag,
                                '3037',
                                `newest npm release ${newestNpmRelease}`,
                            );
                        }
                    }
                }
            } catch (e) {
                context.warnings.push(
                    `[W3038] Could not retrieve npm release information for testing checks: ${e.message}`,
                );
            }
        }
    } catch (e) {
        context.warnings.push(
            `[W3039] Could not retrieve workflow run data for "${WORKFLOW_FILE_SHORT}": ${e.message}`,
        );
    }

    // skip detailled tests if adapter uses legacy testing
    if (!hasLegacyTesting) {
        // --- Check jobs ---
        common.debug('testing jobs');
        const jobs = workflow.jobs || {};

        // Compute effective minimum and recommended node.js versions per non-matrix job.
        // If the engines:node clause in package.json is higher than the config defaults, use that value.
        const testingCfg = config.testingNodeJs;
        common.debug(`    testingCfg: ${JSON.stringify(testingCfg)}`);
        let effectiveMinCheckAndLint = parseInt(testingCfg.minimumNodeVersionCheckAndLint, 10);
        let effectiveRecCheckAndLint = parseInt(testingCfg.recommendedNodeVersionCheckAndLint, 10);
        let effectiveMinDeploy = parseInt(testingCfg.minimumNodeVersionDeploy, 10);
        let effectiveRecDeploy = parseInt(testingCfg.recommendedNodeVersionDeploy, 10);
        let enginesMajor = 0;
        const minimumNodeJsSupported = context.minimumNodeJsSupported;
        common.debug(`    minimumNodeJsSupported: ${minimumNodeJsSupported}`);
        if (minimumNodeJsSupported) {
            enginesMajor = semverMajor(minimumNodeJsSupported);
            common.debug(`    enginesMajor: ${enginesMajor}`);
            if (enginesMajor > effectiveMinCheckAndLint) {
                effectiveMinCheckAndLint = enginesMajor;
            }
            if (enginesMajor > effectiveRecCheckAndLint) {
                effectiveRecCheckAndLint = enginesMajor;
            }
            if (enginesMajor > effectiveMinDeploy) {
                effectiveMinDeploy = enginesMajor;
            }
            if (enginesMajor > effectiveRecDeploy) {
                effectiveRecDeploy = enginesMajor;
            }
        }

        // E3010: check-and-lint job
        if (!jobs['check-and-lint']) {
            common.debug('    job check-and-lint not found');
            if (!context.cfg.onlyWWW) {
                context.errors.push(
                    `[E3010] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" is missing. Please add it.`,
                );
            } else {
                context.warnings.push(
                    `[S3010] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" is missing. Consider adding it.`,
                );
            }
        } else {
            common.debug('    job check-and-lint found');
            context.checks.push('Job "check-and-lint" found.');

            // W3013: check-and-lint must use ioBroker/testing-action-check@v1
            const checkActionPrefix = 'ioBroker/testing-action-check@';
            const requiredCheckActionVersion = testingCfg['ioBroker/testing-action-check'];
            if (!jobHasStepWithAction(jobs['check-and-lint'], checkActionPrefix)) {
                context.warnings.push(
                    `[W3013] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" should contain a step using "ioBroker/testing-action-check@${requiredCheckActionVersion}".`,
                );
            } else {
                context.checks.push(
                    `Job "check-and-lint" uses "ioBroker/testing-action-check@${requiredCheckActionVersion}".`,
                );
                const requiredMajor = parseActionMajorVersion(requiredCheckActionVersion);
                const usedRefs = getJobActionRefs(jobs['check-and-lint'], checkActionPrefix);
                const lowerRefs = usedRefs.filter(ref => {
                    const major = parseActionMajorVersion(ref);
                    return requiredMajor !== null && major !== null && major < requiredMajor;
                });
                for (const lowerRef of lowerRefs) {
                    context.warnings.push(
                        `[W3028] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses "ioBroker/testing-action-check@${lowerRef}" ` +
                            `which is below the required version "${requiredCheckActionVersion}".`,
                    );
                }

                // S3042: warn if a too-specific version ref (e.g. v2.0.0) is used instead of major version only (e.g. v2)
                for (const ref of usedRefs.filter(isOverlySpecificVersionRef)) {
                    const majorVersion = `v${parseActionMajorVersion(ref)}`;
                    context.warnings.push(
                        `[S3042] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses "ioBroker/testing-action-check@${ref}" ` +
                            `with a pinned version. Consider locking only the major version "@${majorVersion}" instead.`,
                    );
                }

                if (!jobHasStepWithActionInputValue(jobs['check-and-lint'], checkActionPrefix, 'lint', true)) {
                    context.warnings.push(
                        `[S3045] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" should enable linting by setting "lint: true" for "ioBroker/testing-action-check@${requiredCheckActionVersion}".`,
                    );
                } else {
                    context.checks.push(
                        `Job "check-and-lint" enables "lint: true" for "ioBroker/testing-action-check@${requiredCheckActionVersion}".`,
                    );
                }
            }

            // E3020 / S3021: check node.js version for check-and-lint job
            const checkLintNodeVersion = getJobNodeMajorVersion(jobs['check-and-lint']);
            if (checkLintNodeVersion !== null) {
                if (checkLintNodeVersion < effectiveMinCheckAndLint) {
                    context.errors.push(
                        `[E3020] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses node.js ${checkLintNodeVersion} ` +
                            `which is below the minimum required version ${effectiveMinCheckAndLint}. ` +
                            `Please update to node.js ${effectiveRecCheckAndLint}.`,
                    );
                } else if (checkLintNodeVersion < effectiveRecCheckAndLint) {
                    context.warnings.push(
                        `[S3021] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses node.js ${checkLintNodeVersion}. ` +
                            `Consider updating to the recommended version ${effectiveRecCheckAndLint}.`,
                    );
                } else {
                    context.checks.push(
                        `Job "check-and-lint" uses node.js ${checkLintNodeVersion} (meets recommended version ${effectiveRecCheckAndLint}).`,
                    );
                }
            }
        }

        // E3011: adapter-tests job
        if (context.cfg.onlyWWW) {
            common.debug('    job adapter-tests skipped');
            context.checks.push('Job "adapter-tests" check skipped (onlyWWW adapter).');
        } else if (!jobs['adapter-tests']) {
            common.debug('    job adapter-tests not found');
            context.errors.push(
                `[E3011] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" is missing. Please add it.`,
            );
        } else {
            common.debug('    job adapter-tests found');
            context.checks.push('Job "adapter-tests" found.');

            // S3014: adapter-tests should need check-and-lint
            if (!jobNeedsAll(jobs['adapter-tests'], ['check-and-lint'])) {
                context.warnings.push(
                    `[S3014] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" should declare "needs: check-and-lint" to run after linting.`,
                );
            } else {
                context.checks.push('Job "adapter-tests" correctly requires "check-and-lint".');
            }

            // W3015: adapter-tests must use ioBroker/testing-action-adapter@v1
            const adapterActionPrefix = 'ioBroker/testing-action-adapter@';
            const requiredAdapterActionVersion = testingCfg['ioBroker/testing-action-adapter'];
            if (!jobHasStepWithAction(jobs['adapter-tests'], adapterActionPrefix)) {
                context.warnings.push(
                    `[W3015] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" should contain a step using "ioBroker/testing-action-adapter@${requiredAdapterActionVersion}".`,
                );
            } else {
                context.checks.push(
                    `Job "adapter-tests" uses "ioBroker/testing-action-adapter@${requiredAdapterActionVersion}".`,
                );
                const requiredMajor = parseActionMajorVersion(requiredAdapterActionVersion);
                const usedRefs = getJobActionRefs(jobs['adapter-tests'], adapterActionPrefix);
                const lowerRefs = usedRefs.filter(ref => {
                    const major = parseActionMajorVersion(ref);
                    return requiredMajor !== null && major !== null && major < requiredMajor;
                });
                for (const lowerRef of lowerRefs) {
                    context.warnings.push(
                        `[W3029] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" uses "ioBroker/testing-action-adapter@${lowerRef}" ` +
                            `which is below the required version "${requiredAdapterActionVersion}".`,
                    );
                }

                // S3043: warn if a too-specific version ref (e.g. v2.0.0) is used instead of major version only (e.g. v2)
                for (const ref of usedRefs.filter(isOverlySpecificVersionRef)) {
                    const majorVersion = `v${parseActionMajorVersion(ref)}`;
                    context.warnings.push(
                        `[S3043] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" uses "ioBroker/testing-action-adapter@${ref}" ` +
                            `with a pinned version. Consider locking only the major version "@${majorVersion}" instead.`,
                    );
                }
            }

            // W3024 / E3025 / W3026: check node.js version matrix for adapter-tests
            const matrixNodeVersions = getMatrixNodeMajorVersions(jobs['adapter-tests']);
            if (matrixNodeVersions.length > 0) {
                // Remove versions lower than engines:node requirement from all version lists before checking.
                const validVersionNums = testingCfg.validMatrixNodeVersions
                    .map(v => parseInt(v, 10))
                    .filter(v => v >= enginesMajor);
                const requiredVersionNums = testingCfg.requiredMatrixNodeVersions
                    .map(v => parseInt(v, 10))
                    .filter(v => v >= enginesMajor);
                const recommendedVersionNums = testingCfg.recommendedMatrixNodeVersions
                    .map(v => parseInt(v, 10))
                    .filter(v => v >= enginesMajor);

                // W3024: warn about versions not in the valid list
                const invalidVersions = matrixNodeVersions.filter(v => !validVersionNums.includes(v));
                for (const v of invalidVersions) {
                    context.warnings.push(
                        `[W3024] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" matrix uses node.js ${v} ` +
                            `which is not in the list of recommended testing versions (${testingCfg.validMatrixNodeVersions.join(', ')}).`,
                    );
                }

                // E3025: error for missing required versions
                const missingRequired = requiredVersionNums.filter(v => !matrixNodeVersions.includes(v));
                for (const v of missingRequired) {
                    context.errors.push(
                        `[E3025] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" matrix is missing required node.js version ${v}. ` +
                            `Tests with node.js ${v} are required.`,
                    );
                }

                // W3026: warn about missing recommended versions (not already flagged as required)
                const missingRecommended = recommendedVersionNums.filter(
                    v => !matrixNodeVersions.includes(v) && !requiredVersionNums.includes(v),
                );
                for (const v of missingRecommended) {
                    context.warnings.push(
                        `[W3026] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" matrix is missing recommended node.js version ${v}. ` +
                            `Consider adding tests with node.js ${v}.`,
                    );
                }

                if (invalidVersions.length === 0 && missingRequired.length === 0 && missingRecommended.length === 0) {
                    context.checks.push(
                        `Job "adapter-tests" matrix node.js versions (${matrixNodeVersions.join(', ')}) are correctly configured.`,
                    );
                }
            }

            // W3027 / S3031: check required OS coverage for adapter-tests
            const requiredOsSystems = testingCfg.requiredOsSystems || ['ubuntu', 'windows', 'macos'];
            const workflowOsAliasMap = testingCfg.workflowOsAliasMap || {};
            const packageOsAliasMap = testingCfg.packageOsAliasMap || {};

            const matrixOs = getMatrixOs(jobs['adapter-tests']);
            const osValues =
                matrixOs.length > 0 ? matrixOs : getAdapterActionStepOs(jobs['adapter-tests'], adapterActionPrefix);
            const osSource = matrixOs.length > 0 ? 'matrix' : 'ioBroker/testing-action-adapter step configuration';
            const testedSystems = normalizeWorkflowOsSystems(osValues, workflowOsAliasMap);
            const missingSystems = requiredOsSystems.filter(system => !testedSystems.includes(system));

            if (missingSystems.length === 0) {
                context.checks.push(
                    `Job "adapter-tests" covers all required operating systems (${requiredOsSystems.join(', ')}) via ${osSource}.`,
                );
            } else {
                const packageOsClause = context.packageJson && context.packageJson.os;
                const allowedSystems = getAllowedRequiredOsSystems(
                    packageOsClause,
                    requiredOsSystems,
                    packageOsAliasMap,
                );
                const excludedMissingSystems = missingSystems.filter(system => !allowedSystems.has(system));
                if (excludedMissingSystems.length > 0) {
                    context.warnings.push(
                        `[S3031] package.json "os" excludes required OS systems (${excludedMissingSystems.join(', ')}). ` +
                            `Please verify whether adapter support can be extended.`,
                    );
                }

                const uncoveredMissingSystems = missingSystems.filter(system => allowedSystems.has(system));
                if (uncoveredMissingSystems.length > 0) {
                    context.warnings.push(
                        `[W3027] Workflow "${WORKFLOW_FILE_SHORT}": testing for OS ${uncoveredMissingSystems.join(', ')} is missing in job "adapter-tests". ` +
                            `Add corresponding tests to "${WORKFLOW_FILE_SHORT}" or adapt package.json "os" accordingly.`,
                    );
                } else {
                    context.checks.push(
                        `Missing OS tests (${missingSystems.join(', ')}) are covered by package.json "os" restrictions.`,
                    );
                }
            }
        }

        // S3012: deploy job (suggestion if missing)
        if (!jobs['deploy']) {
            common.debug('    job deploy found');
            context.warnings.push(
                `[S3012] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" is not defined. Consider adding it for automated releases.`,
            );
        } else {
            common.debug('    job deploy found');
            context.checks.push('Job "deploy" found.');

            // E3016: deploy must depend (directly or transitively) on check-and-lint and adapter-tests,
            // but only if those jobs exist in the workflow
            const requiredDependencies = ['check-and-lint', 'adapter-tests'].filter(j => jobs[j]);
            if (!requiredDependencies.every(req => jobDependsOn(jobs, 'deploy', req))) {
                context.errors.push(
                    `[E3016] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" must declare "needs" for both "check-and-lint" and "adapter-tests".`,
                );
            } else {
                context.checks.push('Job "deploy" correctly requires "check-and-lint" and "adapter-tests".');
            }

            // W3017: deploy must use ioBroker/testing-action-deploy@v1
            const deployActionPrefix = 'ioBroker/testing-action-deploy@';
            const requiredDeployActionVersion = testingCfg['ioBroker/testing-action-deploy'];
            if (!jobHasStepWithAction(jobs['deploy'], deployActionPrefix)) {
                context.warnings.push(
                    `[W3017] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" should contain a step using "ioBroker/testing-action-deploy@${requiredDeployActionVersion}".`,
                );
            } else {
                context.checks.push(
                    `Job "deploy" uses "ioBroker/testing-action-deploy@${requiredDeployActionVersion}".`,
                );
                const requiredMajor = parseActionMajorVersion(requiredDeployActionVersion);
                const usedRefs = getJobActionRefs(jobs['deploy'], deployActionPrefix);
                const lowerRefs = usedRefs.filter(ref => {
                    const major = parseActionMajorVersion(ref);
                    return requiredMajor !== null && major !== null && major < requiredMajor;
                });
                for (const lowerRef of lowerRefs) {
                    context.warnings.push(
                        `[W3030] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses "ioBroker/testing-action-deploy@${lowerRef}" ` +
                            `which is below the required version "${requiredDeployActionVersion}".`,
                    );
                }

                // S3044: warn if a too-specific version ref (e.g. v2.0.0) is used instead of major version only (e.g. v2)
                for (const ref of usedRefs.filter(isOverlySpecificVersionRef)) {
                    const majorVersion = `v${parseActionMajorVersion(ref)}`;
                    context.warnings.push(
                        `[S3044] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses "ioBroker/testing-action-deploy@${ref}" ` +
                            `with a pinned version. Consider locking only the major version "@${majorVersion}" instead.`,
                    );
                }

                // S3018: check trusted publishing permissions at job level
                const permissions = jobs['deploy'].permissions;
                const hasContentsWrite = permissions && permissions.contents === 'write';
                const hasIdTokenWrite = permissions && permissions['id-token'] === 'write';
                if (!hasContentsWrite || !hasIdTokenWrite) {
                    context.warnings.push(
                        `[S3018] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" is missing required permissions "contents: write" and "id-token: write" at job level. ` +
                            `Trusted publishing will not work without them.`,
                    );
                } else {
                    context.checks.push(
                        'Job "deploy" has required trusted publishing permissions (contents: write, id-token: write).',
                    );
                }

                // W3019: check that npm-token is not specified in the deploy action step
                const deployStep = jobs['deploy'].steps.find(
                    step => typeof step.uses === 'string' && step.uses.startsWith(deployActionPrefix),
                );
                if (
                    deployStep &&
                    deployStep.with &&
                    Object.prototype.hasOwnProperty.call(deployStep.with, 'npm-token')
                ) {
                    context.warnings.push(
                        `[W3019] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" step using "ioBroker/testing-action-deploy@v1" ` +
                            `has "npm-token" parameter specified. ` +
                            `Trusted publishing will not work while "npm-token" is set.`,
                    );
                } else {
                    context.checks.push('Job "deploy" step does not use "npm-token" (trusted publishing compatible).');
                }
            }

            // E3022 / S3023: check node.js version for deploy job
            const deployNodeVersion = getJobNodeMajorVersion(jobs['deploy']);
            if (deployNodeVersion !== null) {
                if (deployNodeVersion < effectiveMinDeploy) {
                    context.errors.push(
                        `[E3022] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses node.js ${deployNodeVersion} ` +
                            `which is below the minimum required version ${effectiveMinDeploy}. ` +
                            `Please update to node.js ${effectiveRecDeploy}.`,
                    );
                } else if (deployNodeVersion < effectiveRecDeploy) {
                    context.warnings.push(
                        `[S3023] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses node.js ${deployNodeVersion}. ` +
                            `Consider updating to the recommended version ${effectiveRecDeploy}.`,
                    );
                } else {
                    context.checks.push(
                        `Job "deploy" uses node.js ${deployNodeVersion} (meets recommended version ${effectiveRecDeploy}).`,
                    );
                }
            }
        }
    }

    return context;
}

exports.checkTests = checkTests;

// List of error and warnings used at this module
// ----------------------------------------------

// [E3000] Neither "@iobroker/testing" nor "@iobroker/legacy-testing" is listed as a devDependency in package.json. Please add one of them.
// [S3001] "@iobroker/legacy-testing" is used. Consider migrating to "@iobroker/testing" for better support.
// [E3002] Workflow file "${WORKFLOW_FILE}" not found. Please create it for standard CI/CD testing.
// [E3003] Workflow file "${WORKFLOW_FILE}" could not be read, is empty, not valid YAML, or does not contain valid workflow content.
// [W3004] Workflow "name" in "${WORKFLOW_FILE_SHORT}" must be "Test and Release".
// [W3005] Workflow "${WORKFLOW_FILE_SHORT}" should have "pull_request: {}" in the "on" trigger configuration.
// [E3006] Workflow "${WORKFLOW_FILE_SHORT}" is missing the "push" trigger in the "on" configuration.
// [E3007] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger is missing "branches" configuration.
// [E3008] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger is missing "tags" configuration.
// [W3009] Workflow "${WORKFLOW_FILE_SHORT}" is missing recommended concurrency configuration.
// [S3010] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" is missing. Consider adding it.
// [E3010] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" is missing. Please add it.
// [E3011] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" is missing. Please add it.
// [S3012] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" is not defined. Consider adding it for automated releases.
// [W3013] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" should contain a step using "ioBroker/testing-action-check@${requiredCheckActionVersion}".
// [S3014] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" should declare "needs: check-and-lint" to run after linting.
// [W3015] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" should contain a step using "ioBroker/testing-action-adapter@${requiredAdapterActionVersion}".
// [E3016] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" must declare "needs" for both "check-and-lint" and "adapter-tests".
// [W3017] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" should contain a step using "ioBroker/testing-action-deploy@${requiredDeployActionVersion}".
// [S3018] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" is missing required permissions "contents: write" and "id-token: write" at job level.
// [W3019] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" step using "ioBroker/testing-action-deploy@v1" has "npm-token" parameter specified.
// [E3020] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses node.js ${checkLintNodeVersion} which is below the minimum required version.
// [S3021] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses node.js ${checkLintNodeVersion}. Consider updating.
// [E3022] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses node.js ${deployNodeVersion} which is below the minimum required version.
// [S3023] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses node.js ${deployNodeVersion}. Consider updating.
// [W3024] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" matrix uses node.js ${v} which is below the minimum required version.
// [E3025] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" matrix is missing required node.js version ${v}.
// [W3026] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" matrix is missing recommended node.js version ${v}.
// [W3027] Workflow "${WORKFLOW_FILE_SHORT}": testing for OS ${uncoveredMissingSystems} is missing.
// [W3028] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses "ioBroker/testing-action-check@${lowerRef}" which is below the required version.
// [W3029] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" uses "ioBroker/testing-action-adapter@${lowerRef}" which is below the required version.
// [W3030] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses "ioBroker/testing-action-deploy@${lowerRef}" which is below the required version.
// [W3031] No workflow runs found for "${WORKFLOW_FILE_SHORT}".
// [E3031] Latest workflow run of "${WORKFLOW_FILE_SHORT}" on branch "${defaultBranch}" failed.
// [S3031] package.json "os" excludes required OS systems.
// [W3032] Release ${currentRelease} from io-package.json/package.json has not yet been tagged. Tagging releases is required.
// [W3033] Could not validate npm release information because adapter name "${adapterName}" is not in a valid npm package name format.
// [E3034] Release ${npmLatestRelease} tagged as "latest" at npm has not yet been tagged at GitHub. Tagging of releases is required.
// [W3035] No workflow run for "${WORKFLOW_FILE_SHORT}" triggered by tag "${taggedVersion}" was found for ...
// [E3036] Newest npm release ${newestNpmRelease} has not yet been tagged at GitHub. Tagging of releases is required.
// [E3037] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger "branches" must include "*" or the default branch.
// [W3038] Could not retrieve npm release information for testing checks: ${e.message}
// [W3039] Could not retrieve workflow run data for "${WORKFLOW_FILE_SHORT}": ${e.message}
// [E3040] Workflow "${WORKFLOW_FILE_SHORT}": "push" trigger "tags" is missing required pattern(s).
// [W3041] Latest workflow run of "${WORKFLOW_FILE_SHORT}" on branch "${defaultBranch}" was cancelled.
// [S3042] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" uses "ioBroker/testing-action-check@${ref}" with a pinned version. Consider locking only the major version.
// [S3043] Workflow "${WORKFLOW_FILE_SHORT}": job "adapter-tests" uses "ioBroker/testing-action-adapter@${ref}" with a pinned version. Consider locking only the major version.
// [S3044] Workflow "${WORKFLOW_FILE_SHORT}": job "deploy" uses "ioBroker/testing-action-deploy@${ref}" with a pinned version. Consider locking only the major version.
// [S3045] Workflow "${WORKFLOW_FILE_SHORT}": job "check-and-lint" should enable linting by setting "lint: true".

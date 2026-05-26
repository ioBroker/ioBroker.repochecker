'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Dependabot configuration
    Numbering   :   8900 - 8999

*/

const yaml = require('js-yaml');
const { minimatch } = require('minimatch');
const common = require('./common.js');

const DEPENDABOT_FILE = '/.github/dependabot.yml';
const AUTOMERGE_FILE = '/.github/workflows/automerge-dependabot.yml';
const OLD_AUTOMERGE_FILE = '/.github/workflows/dependabot-auto-merge.yml';
const OLD_AUTOMERGE_FILE_OLD = '/.github/workflows/dependabot-auto-merge.yml.OLD';
const AUTO_MERGE_CONFIG = '/.github/auto-merge.yml';
const WORKFLOW_DIR = '/.github/workflows/';

// GitHub organisations whose actions must use versioned references
const IOBROKER_ACTION_ORGS = ['iobroker', 'iobroker-community-adapters', 'iobroker-bot-orga'];

/**
 * Returns true if the given file path exists in the context's filesList,
 * handling both the leading-slash (remote) and no-leading-slash (local) formats.
 *
 * @param {object} context - The checker context
 * @param {string} filePath - File path with leading slash (e.g. '/.github/dependabot.yml')
 * @returns {boolean} true if file is found in filesList
 */
function fileExistsInList(context, filePath) {
    if (!context.filesList) {
        throw new Error('FATAL: context.filesList is undefined');
    }
    return context.filesList.includes(filePath) || context.filesList.includes(filePath.replace(/^\//, ''));
}

/**
 * Normalizes a dependabot directory specification to absolute unix-style format.
 *
 * @param {unknown} directory - Directory specification from dependabot config
 * @returns {string | null} Normalized directory or null for invalid input
 */
function normalizeDirectorySpec(directory) {
    if (typeof directory !== 'string') {
        return null;
    }

    const trimmed = directory.trim();
    if (!trimmed) {
        return null;
    }

    const withUnixSeparators = trimmed.replace(/\\/g, '/');
    if (withUnixSeparators === '/') {
        return '/';
    }

    const withLeadingSlash = withUnixSeparators.startsWith('/') ? withUnixSeparators : `/${withUnixSeparators}`;
    return withLeadingSlash.replace(/\/+$/, '') || '/';
}

/**
 * Returns the directory path for a package.json file path.
 *
 * @param {string} filePath - Path to package.json
 * @returns {string} Directory path (always starts with "/")
 */
function getPackageJsonDirectory(filePath) {
    const normalizedFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`;
    const lastSlash = normalizedFilePath.lastIndexOf('/');
    if (lastSlash <= 0) {
        return '/';
    }
    return normalizedFilePath.substring(0, lastSlash) || '/';
}

/**
 * Returns true when the directory specification is a known wildcard-all shortcut.
 *
 * @param {string} directorySpec - Normalized dependabot directory specification
 * @returns {boolean} true if this pattern covers all directories
 */
function isAllDirectoriesShortcut(directorySpec) {
    return (
        directorySpec === '**' ||
        directorySpec === '**/*' ||
        directorySpec === '*/**' ||
        directorySpec === '/**' ||
        directorySpec === '/**/*'
    );
}

/**
 * Returns true if a dependabot directory specification covers the package directory.
 *
 * @param {string} packageDirectory - Directory containing package.json
 * @param {unknown} rawDirectorySpec - Raw directory specification from dependabot config
 * @returns {boolean} true if directory specification matches package directory
 */
function directorySpecMatchesPackageDirectory(packageDirectory, rawDirectorySpec) {
    const directorySpec = normalizeDirectorySpec(rawDirectorySpec);
    if (!directorySpec) {
        return false;
    }

    if (isAllDirectoriesShortcut(directorySpec)) {
        return true;
    }

    if (!/[*?[\]{}]/.test(directorySpec)) {
        return packageDirectory === directorySpec;
    }

    return minimatch(packageDirectory, directorySpec, { dot: true });
}

/**
 * Returns true if an npm dependabot entry covers the given package directory.
 *
 * @param {object} npmEntry - Dependabot update entry with package-ecosystem npm
 * @param {string} packageDirectory - Directory containing package.json
 * @returns {boolean} true if npm entry covers the package directory
 */
function npmEntryCoversPackageDirectory(npmEntry, packageDirectory) {
    if (directorySpecMatchesPackageDirectory(packageDirectory, npmEntry['directory'])) {
        return true;
    }

    const configuredDirectories = npmEntry['directories'];
    if (!Array.isArray(configuredDirectories)) {
        return false;
    }

    return configuredDirectories.some(directorySpec =>
        directorySpecMatchesPackageDirectory(packageDirectory, directorySpec),
    );
}

/**
 * Recursively collects all `uses:` string values from a parsed workflow object.
 *
 * @param {unknown} obj - A parsed YAML value (object, array, or primitive)
 * @returns {string[]} All `uses:` string values found
 */
function extractUsesValues(obj) {
    const usesValues = [];
    if (!obj || typeof obj !== 'object') {
        return usesValues;
    }
    if (Array.isArray(obj)) {
        for (const item of obj) {
            usesValues.push(...extractUsesValues(item));
        }
    } else {
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'uses' && typeof value === 'string') {
                usesValues.push(value);
            } else {
                usesValues.push(...extractUsesValues(value));
            }
        }
    }
    return usesValues;
}

/**
 * Returns true when a GitHub Actions `uses:` value references an ioBroker-owned action
 * without a versioned tag (e.g. `@main`, `@master`, or missing `@ref`).
 *
 * A reference is considered versioned only when the part after `@` starts with `v`
 * followed by a digit (e.g. `@v1`, `@v2.3`, `@v1.0.0`).
 *
 * @param {string} usesValue - The raw `uses:` string value
 * @returns {boolean} true when the action belongs to an ioBroker org and uses a non-versioned ref
 */
function isIoBrokerActionWithNonVersionedRef(usesValue) {
    // `uses` for local actions (./path) or Docker actions (docker://) are not checked
    if (usesValue.startsWith('./') || usesValue.startsWith('docker://')) {
        return false;
    }
    // Extract the owner (the part before the first `/`)
    const slashIndex = usesValue.indexOf('/');
    if (slashIndex === -1) {
        return false;
    }
    const owner = usesValue.substring(0, slashIndex).toLowerCase();
    if (!IOBROKER_ACTION_ORGS.includes(owner)) {
        return false;
    }
    // Check the ref after `@`
    const atIndex = usesValue.lastIndexOf('@');
    if (atIndex === -1) {
        // No `@ref` at all — unversioned
        return true;
    }
    const ref = usesValue.substring(atIndex + 1);
    // Versioned: must start with `v` followed by a digit (e.g. v1, v2.3, v1.0.0)
    return !/^v\d/.test(ref);
}

/**
 * Checks all `.github/workflows/*.yml` / `.yaml` files for iobroker action references
 * that do not use a versioned tag.
 *
 * @param {object} context - The checker context
 */
async function checkWorkflowActionVersions(context) {
    const workflowFiles = context.filesList.filter(f => {
        const normalized = f.startsWith('/') ? f : `/${f}`;
        return normalized.startsWith(WORKFLOW_DIR) && (normalized.endsWith('.yml') || normalized.endsWith('.yaml'));
    });

    for (const filePath of workflowFiles) {
        const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        let fileContent;
        try {
            fileContent = await common.getFile(context, normalizedPath);
        } catch {
            continue; // File unreadable – other checks will report this
        }

        if (!fileContent) {
            continue;
        }

        let workflow;
        try {
            workflow = yaml.load(fileContent);
        } catch {
            continue; // Invalid YAML – other checks will report this
        }

        if (!workflow || typeof workflow !== 'object') {
            continue;
        }

        const usesValues = extractUsesValues(workflow);
        const shortPath = normalizedPath.replace(WORKFLOW_DIR, '');

        for (const usesValue of usesValues) {
            if (isIoBrokerActionWithNonVersionedRef(usesValue)) {
                const atIndex = usesValue.lastIndexOf('@');
                const refDesc =
                    atIndex !== -1 ? `non-versioned ref "@${usesValue.substring(atIndex + 1)}"` : 'no version tag';
                context.warnings.push(
                    `[W8918] Workflow "${shortPath}" references ioBroker action "${usesValue}" with ${refDesc}. ` +
                        `Please use a versioned tag like "@v1".`,
                );
            }
        }
    }
}

/**
 * Checks the automerge workflow configuration.
 *
 * @param {object} context - The checker context
 */
async function checkAutomerge(context) {
    const hasNewAutomerge = fileExistsInList(context, AUTOMERGE_FILE);
    const hasOldAutomerge = fileExistsInList(context, OLD_AUTOMERGE_FILE);
    const automergeConfigured = hasNewAutomerge || hasOldAutomerge;

    if (!automergeConfigured) {
        // S8913: Suggest to set up automerging
        context.warnings.push(
            `[S8913] No automerge workflow for dependabot PRs found. Consider setting up automerging by adding ".github/workflows/automerge-dependabot.yml".`,
        );
        return;
    }

    context.checks.push('Automerge workflow found.');

    // Validate automerge files as YAML and check for deprecated action
    const filesToCheck = [];
    if (hasNewAutomerge) {
        filesToCheck.push(AUTOMERGE_FILE);
    }
    if (hasOldAutomerge) {
        filesToCheck.push(OLD_AUTOMERGE_FILE);
    }

    for (const filePath of filesToCheck) {
        let fileContent;
        try {
            fileContent = await common.getFile(context, filePath);
        } catch (e) {
            context.errors.push(
                `[E8912] Cannot read automerge workflow file "${filePath}": ${e.message.split('\n')[0]}`,
            );
            continue;
        }

        if (!fileContent) {
            context.errors.push(`[E8912] Automerge workflow file "${filePath}" is empty.`);
            continue;
        }

        try {
            yaml.load(fileContent);
        } catch (e) {
            context.errors.push(
                `[E8912] Automerge workflow file "${filePath}" is not valid YAML: ${e.message.split('\n')[0]}`,
            );
            continue;
        }

        context.checks.push(`Automerge workflow file "${filePath}" is valid YAML.`);

        // E8912: Check for deprecated action
        if (fileContent.includes('ahmadnassri/action-dependabot-auto-merge')) {
            context.errors.push(
                `[E8912] Automerge workflow file "${filePath}" uses deprecated action "ahmadnassri/action-dependabot-auto-merge" which no longer works. ` +
                    `Please migrate to "iobroker-bot-orga/action-automerge-dependabot@v1".`,
            );
        }
    }

    // S8914: If automerging is active and .github/auto-merge.yml does not exist, suggest to add it
    if (!fileExistsInList(context, AUTO_MERGE_CONFIG)) {
        context.warnings.push(
            `[S8914] Automerge is configured but ".github/auto-merge.yml" was not found. Consider adding it to allow specific automerge configurations.`,
        );
    } else {
        context.checks.push('".github/auto-merge.yml" found.');
    }
}

async function checkDependabot(context) {
    console.log('\n[E8900 - E8999] checking dependabot');

    // W8918: Check all workflow files for non-versioned iobroker action references
    await checkWorkflowActionVersions(context);

    // S8901: Check if dependabot.yml exists
    if (!fileExistsInList(context, DEPENDABOT_FILE)) {
        context.warnings.push(
            `[S8901] Dependabot configuration file ".github/dependabot.yml" not found. Consider adding dependabot to keep dependencies up to date.`,
        );
        // Do not check automerge if dependabot is not configured
        return context;
    }

    context.checks.push('Dependabot configuration file ".github/dependabot.yml" found.');

    // Load and validate dependabot.yml
    let content;
    try {
        content = await common.getFile(context, DEPENDABOT_FILE);
    } catch (e) {
        context.errors.push(
            `[E8902] Cannot read dependabot configuration file "${DEPENDABOT_FILE}": ${e.message.split('\n')[0]}`,
        );
        await checkAutomerge(context);
        return context;
    }

    if (!content) {
        context.errors.push(`[E8902] Dependabot configuration file "${DEPENDABOT_FILE}" is empty.`);
        await checkAutomerge(context);
        return context;
    }

    // E8902: Validate YAML
    let dependabotConfig;
    try {
        dependabotConfig = yaml.load(content);
    } catch (e) {
        context.errors.push(
            `[E8902] Dependabot configuration file "${DEPENDABOT_FILE}" is not valid YAML: ${e.message.split('\n')[0]}`,
        );
        await checkAutomerge(context);
        return context;
    }

    if (!dependabotConfig || typeof dependabotConfig !== 'object') {
        context.errors.push(
            `[E8902] Dependabot configuration file "${DEPENDABOT_FILE}" does not contain a valid dependabot configuration.`,
        );
        await checkAutomerge(context);
        return context;
    }

    context.checks.push('Dependabot configuration file is valid YAML.');

    const updates = dependabotConfig.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
        context.errors.push(
            `[E8903] Dependabot configuration "${DEPENDABOT_FILE}" has no "updates" entries. At least "github-actions" and "npm" ecosystems should be configured.`,
        );
        await checkAutomerge(context);
        return context;
    }

    // W8916: Check for github-actions ecosystem
    const hasGithubActions = updates.some(u => u['package-ecosystem'] === 'github-actions');
    if (!hasGithubActions) {
        context.warnings.push(
            `[W8916] Dependabot configuration "${DEPENDABOT_FILE}" has no entry with "package-ecosystem: github-actions". Please add one.`,
        );
    } else {
        context.checks.push('Dependabot is configured for "github-actions" ecosystem.');
    }

    // E8904: Check for npm ecosystem
    const hasNpm = updates.some(u => u['package-ecosystem'] === 'npm');
    if (!hasNpm) {
        context.errors.push(
            `[E8904] Dependabot configuration "${DEPENDABOT_FILE}" has no entry with "package-ecosystem: npm". Please add one.`,
        );
    } else {
        context.checks.push('Dependabot is configured for "npm" ecosystem.');
    }

    // W8905: Ensure every non-root package.json directory is covered by at least one npm dependabot entry
    if (hasNpm) {
        const nonRootPackageJsonFiles = context.filesList.filter(f => {
            const normalized = f.startsWith('/') ? f : `/${f}`;
            // Match any package.json that is NOT at the root
            return /\/[^/]+\/.*package\.json$/.test(normalized);
        });

        if (nonRootPackageJsonFiles.length > 0) {
            const npmEntries = updates.filter(u => u['package-ecosystem'] === 'npm');
            const unmatchedPackageJsonFiles = nonRootPackageJsonFiles.filter(filePath => {
                const packageDirectory = getPackageJsonDirectory(filePath);
                return !npmEntries.some(entry => npmEntryCoversPackageDirectory(entry, packageDirectory));
            });

            if (unmatchedPackageJsonFiles.length > 0) {
                context.warnings.push(
                    `[W8905] Repository contains package.json files in non-root directories (e.g. ${unmatchedPackageJsonFiles.slice(0, 3).join(', ')}), ` +
                        `but no npm dependabot entry matches affected directories. Add matching "directory" or "directories" entries.`,
                );
            } else {
                context.checks.push('Dependabot npm entries cover all non-root package.json directories.');
            }
        }
    }

    // W8915: Check npm entries for cooldown configuration to reduce supply chain risk
    if (hasNpm) {
        const npmEntries = updates.filter(u => u['package-ecosystem'] === 'npm');
        for (const npmEntry of npmEntries) {
            const cooldownConfig = npmEntry['cooldown'];
            const entryDir = npmEntry['directory'] || '/';

            if (cooldownConfig == null) {
                context.warnings.push(
                    `[W8915] Dependabot npm entry (directory: "${entryDir}") has no "cooldown" configured. ` +
                        `A cooldown of at least 7 days (e.g. "cooldown: { default: 7 }") is recommended to reduce supply chain risk.`,
                );
            } else {
                let effectiveCooldown = null;
                if (typeof cooldownConfig === 'number') {
                    effectiveCooldown = cooldownConfig;
                } else if (typeof cooldownConfig === 'object' && typeof cooldownConfig['default'] === 'number') {
                    effectiveCooldown = cooldownConfig['default'];
                }

                if (effectiveCooldown !== null && effectiveCooldown < 5) {
                    context.warnings.push(
                        `[W8915] Dependabot npm entry (directory: "${entryDir}") has a cooldown of ${effectiveCooldown} days which is less than 5 days. ` +
                            `A cooldown of at least 7 days is recommended to reduce supply chain risk.`,
                    );
                } else if (effectiveCooldown !== null) {
                    context.checks.push(
                        `Dependabot npm entry (directory: "${entryDir}") has a cooldown of ${effectiveCooldown} days configured.`,
                    );
                }
            }
        }
    }

    // W8917: Check for @types/node ignore on root or wildcard npm entries
    if (hasNpm) {
        const npmEntries = updates.filter(u => u['package-ecosystem'] === 'npm');
        let missingTypesNodeIgnore = false;

        for (const npmEntry of npmEntries) {
            const entryDirectory = npmEntry['directory'];
            const configuredDirectories = npmEntry['directories'];
            const usesRootDirectory =
                entryDirectory === '/' ||
                (Array.isArray(configuredDirectories) &&
                    configuredDirectories.some(dir => dir === '**/*' || dir === '**' || dir === '/'));

            if (!usesRootDirectory) {
                continue;
            }

            const ignoreEntries = Array.isArray(npmEntry['ignore']) ? npmEntry['ignore'] : [];
            const typesNodeIgnore = ignoreEntries.find(entry => entry && entry['dependency-name'] === '@types/node');
            const updateTypes = typesNodeIgnore ? typesNodeIgnore['update-types'] : null;
            const updateTypesList = Array.isArray(updateTypes)
                ? updateTypes
                : typeof updateTypes === 'string'
                  ? [updateTypes]
                  : [];
            const hasRequiredUpdateType = updateTypesList.some(
                type => type === 'version-update:semver-major' || type === 'version-update:semver-minor',
            );

            if (!hasRequiredUpdateType) {
                missingTypesNodeIgnore = true;
                break;
            }
        }

        if (missingTypesNodeIgnore) {
            context.warnings.push(
                `[W8917] At least major versions of @types/node should not be updated by dependabot. Please add ignore block at dependabot.yml.`,
            );
        }
    }

    // Check each update entry for schedule and open-pull-requests-limit issues
    const monthlyEcosystems = [];
    for (const update of updates) {
        const ecosystem = update['package-ecosystem'] || '(unknown)';
        const schedule = update['schedule'] || {};
        const interval = schedule['interval'];

        // S8906: Suggest cron instead of monthly (collect all affected ecosystems first)
        if (interval === 'monthly') {
            monthlyEcosystems.push(ecosystem);

            // W8909: 'day' is not supported by monthly schedule
            if (Object.prototype.hasOwnProperty.call(schedule, 'day')) {
                context.warnings.push(
                    `[W8909] Dependabot entry for "${ecosystem}" uses "schedule: interval: monthly" with a "day" setting. ` +
                        `The "day" setting is not supported for monthly schedules and should be removed.`,
                );
            }
        }

        // W8907 / S8908: open-pull-requests-limit checks
        if (Object.prototype.hasOwnProperty.call(update, 'open-pull-requests-limit')) {
            const limit = update['open-pull-requests-limit'];
            if (typeof limit === 'number') {
                if (limit < 5) {
                    context.warnings.push(
                        `[W8907] Dependabot entry for "${ecosystem}" has "open-pull-requests-limit: ${limit}" which is very low and could cause incomplete dependency updates.`,
                    );
                } else if (limit < 10) {
                    context.warnings.push(
                        `[S8908] Dependabot entry for "${ecosystem}" has "open-pull-requests-limit: ${limit}". A limit of at least 15 is recommended.`,
                    );
                }
            }
        }
    }

    // S8906: Emit a single combined suggestion if any entries use "monthly"
    if (monthlyEcosystems.length > 0) {
        const ecosystemList = monthlyEcosystems.map(ecosystem => `"${ecosystem}"`).join(', ');
        context.warnings.push(
            `[S8906] Some Dependabot entries (${ecosystemList}) use "schedule: interval: monthly". ` +
                `Consider migrating to random cron schedule ("schedule: interval: cron") for load distribution.`,
        );
    }

    // S8910: Check if OLD automerge file (.OLD suffix) exists
    if (fileExistsInList(context, OLD_AUTOMERGE_FILE_OLD)) {
        context.warnings.push(
            `[S8910] File "${OLD_AUTOMERGE_FILE_OLD}" was found. If it is no longer needed, consider deleting it.`,
        );
    }

    // S8911: Check if old dependabot-auto-merge.yml exists, suggest migration to automerge-dependabot.yml
    if (fileExistsInList(context, OLD_AUTOMERGE_FILE)) {
        context.warnings.push(
            `[S8911] File "${OLD_AUTOMERGE_FILE}" was found. Consider migrating to the new standard workflow "automerge-dependabot.yml".`,
        );
    }

    // Check automerge configuration
    await checkAutomerge(context);

    return context;
}

exports.checkDependabot = checkDependabot;

// List of error and warnings used at this module
// ----------------------------------------------

// [S8901] Dependabot configuration file ".github/dependabot.yml" not found.
// [E8902] Dependabot configuration file is not valid YAML or cannot be read.
// [E8903] No entry with "package-ecosystem:" found.
// [E8904] No entry with "package-ecosystem: npm" found.
// [W8905] Repository has non-root package.json directories not covered by npm dependabot entries.
// [S8906] Suggest cron instead of monthly schedule.
// [W8907] open-pull-requests-limit < 5 (very low).
// [S8908] open-pull-requests-limit < 10 (recommend at least 15).
// [W8909] 'day' setting not supported with monthly schedule.
// [S8910] Suggest to delete dependabot-auto-merge.yml.OLD.
// [S8911] Suggest to migrate dependabot-auto-merge.yml to automerge-dependabot.yml.
// [E8912] Automerge workflow file uses deprecated action or is invalid YAML.
// [S8913] Suggest to set up automerging.
// [S8914] Automerging is active but .github/auto-merge.yml not found.
// [W8915] npm entry has no cooldown or cooldown < 5 days configured.
// [W8916] Dependabot configuration "${DEPENDABOT_FILE}" has no entry with "package-ecosystem: github-actions". Please add one.
// [W8917] At east major versions of @types/node should not be updated by dependabot. Please add ignore block at dependabot.yml.
// [W8918] Workflow uses ioBroker action with non-versioned ref (e.g. @main, @master). Use a versioned tag like @v1.

'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Dependabot configuration
    Numbering   :   8900 - 8999

*/

const yaml = require('js-yaml');
const common = require('./common.js');

const DEPENDABOT_FILE = '/.github/dependabot.yml';
const AUTOMERGE_FILE = '/.github/workflows/automerge-dependabot.yml';
const OLD_AUTOMERGE_FILE = '/.github/workflows/dependabot-auto-merge.yml';
const OLD_AUTOMERGE_FILE_OLD = '/.github/workflows/dependabot-auto-merge.yml.OLD';
const AUTO_MERGE_CONFIG = '/.github/auto-merge.yml';

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
        return false;
    }
    return context.filesList.includes(filePath) || context.filesList.includes(filePath.replace(/^\//, ''));
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

    // S8901: Check if dependabot.yml exists
    if (!fileExistsInList(context, DEPENDABOT_FILE)) {
        context.warnings.push(
            `[S8901] Dependabot configuration file ".github/dependabot.yml" not found. Consider adding dependabot to keep dependencies up to date.`,
        );
        // Still check automerge configuration even if dependabot.yml is missing
        await checkAutomerge(context);
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

    // E8903: Check for github-actions ecosystem
    const hasGithubActions = updates.some(u => u['package-ecosystem'] === 'github-actions');
    if (!hasGithubActions) {
        context.errors.push(
            `[E8903] Dependabot configuration "${DEPENDABOT_FILE}" has no entry with "package-ecosystem: github-actions". Please add one.`,
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

    // W8905: If multiple package.json files exist in non-root directories, check npm entry uses directories wildcard
    if (hasNpm) {
        const filesList = context.filesList || [];
        const nonRootPackageJsonFiles = filesList.filter(f => {
            const normalized = f.startsWith('/') ? f : `/${f}`;
            // Match any package.json that is NOT at the root
            return /\/[^/]+\/.*package\.json$/.test(normalized);
        });

        if (nonRootPackageJsonFiles.length > 0) {
            const npmEntries = updates.filter(u => u['package-ecosystem'] === 'npm');
            const hasDirectoriesWildcard = npmEntries.some(u => {
                const configuredDirectories = u['directories'];
                return (
                    Array.isArray(configuredDirectories) &&
                    configuredDirectories.some(dir => dir === '**/*' || dir === '**')
                );
            });

            if (!hasDirectoriesWildcard) {
                context.warnings.push(
                    `[W8905] Repository contains package.json files in non-root directories (e.g. ${nonRootPackageJsonFiles.slice(0, 3).join(', ')}). ` +
                        `Dependabot may miss updates unless the "npm" ecosystem entry uses "directories: ['**/*']" instead of "directory: '/'"`,
                );
            } else {
                context.checks.push(
                    'Dependabot npm entry uses "directories" wildcard covering non-root package.json files.',
                );
            }
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
// [E8903] No entry with "package-ecosystem: github-actions" found.
// [E8904] No entry with "package-ecosystem: npm" found.
// [W8905] Repository has non-root package.json but npm entry does not use directories wildcard.
// [S8906] Suggest cron instead of monthly schedule.
// [W8907] open-pull-requests-limit < 5 (very low).
// [S8908] open-pull-requests-limit < 10 (recommend at least 15).
// [W8909] 'day' setting not supported with monthly schedule.
// [S8910] Suggest to delete dependabot-auto-merge.yml.OLD.
// [S8911] Suggest to migrate dependabot-auto-merge.yml to automerge-dependabot.yml.
// [E8912] Automerge workflow file uses deprecated action or is invalid YAML.
// [S8913] Suggest to set up automerging.
// [S8914] Automerging is active but .github/auto-merge.yml not found.

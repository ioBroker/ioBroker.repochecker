'use strict';
/*
    This module contains postprocessing tasks for iobroker.repochecker.

    Postprocessing tasks are run after all check modules have completed and
    can manipulate errors, warnings, suggestions, and infos in the context.

*/

// ---------------------------------------------------------------------------
// Configuration tables
// ---------------------------------------------------------------------------

/**
 * Severity remapping table for new adapters (used by adaptSeverity4New).
 *
 * Key   : original issue key (e.g. "W0028")
 * Value : target severity – one of 'E' (error), 'W' (warning), 'S' (suggestion),
 *         or 'N' (none / drop the issue entirely).
 *
 * When context.cfg.isNewAdapter is set, every raised issue whose key appears
 * in this table will be removed from its current storage array and re-inserted
 * with the new severity (or silently dropped for 'N').
 */
const mapSeverity4New = {
    W0028: 'E', // [W0028] Minimum node.js version 20 recommended.
    W1027: 'E', // [W1027] Missing suggested translation into ru,pt,nl,fr,it,es,pl,uk,zh-cn of "common.titleLang"
    W1032: 'E', // [W1032] Many "common.news" found in io-package.json
    W1034: 'E', // [W1034] Missing suggested translation into ru,pt,nl,fr,it,es,pl,uk,zh-cn of "common.desc"
    S0062: 'W', // [S0062] Consider adding and using package "@alcalzone/release-script".
    S6008: 'E', // [S6008] Changelog for version 0.7.0-beta.19 should be added to README.md
    S6020: 'W', // [S6020] Consider adding a CHANGELOG_OLD.md file to store older changelog entries. This is supported by @alcalzone/releasescript.
    S8901: 'W', // [S8901] Dependabot configuration file ".github/dependabot.yml" not found. Consider adding dependabot to keep dependencies up to date.
    S9006: 'E', // [S9006] .commitinfo file should be excluded by .gitignore, please add a line with text ".commitinfo" to .gitignore
};

// ---------------------------------------------------------------------------
// Postprocessing tasks
// ---------------------------------------------------------------------------

/**
 * Remaps the severity of issues for new adapters according to mapSeverity4New.
 *
 * If context.cfg.isNewAdapter is not set the function returns immediately
 * without any changes.
 *
 * For each entry in context.errors and context.warnings the issue key is
 * extracted (e.g. "W1234" from "[W1234] …"). If the key is present in
 * mapSeverity4New the entry is removed from its current array and either
 * re-inserted with the new severity prefix or dropped (when target is 'N').
 *
 * @param {object} context - The checker context
 * @returns {object} The (possibly modified) context
 */
function adaptSeverity4New(context) {
    if (!context.cfg || !context.cfg.isNewAdapter) {
        return context;
    }

    /**
     * Process a single array of issue strings in-place.
     * Entries that need to change severity are removed and collected for
     * re-insertion so that the iteration index stays consistent.
     *
     * @param {string[]} sourceArray - The array to scan (errors or warnings)
     */
    function processArray(sourceArray) {
        // Collect items to re-route so we don't mutate while iterating
        const toReroute = [];

        for (let i = sourceArray.length - 1; i >= 0; i--) {
            const entry = sourceArray[i];
            const match = entry.match(/^\[([EWSI]\d+)\]/);
            if (!match) {
                continue;
            }

            const issueKey = match[1]; // e.g. "W1234"
            if (!Object.prototype.hasOwnProperty.call(mapSeverity4New, issueKey)) {
                continue;
            }

            const targetSeverity = mapSeverity4New[issueKey];

            // Remove from current position
            sourceArray.splice(i, 1);

            if (targetSeverity !== 'N') {
                // Replace the key prefix in the message, e.g. [W1234] -> [E1234]
                const numPart = issueKey.slice(1); // "1234"
                const newKey = `${targetSeverity}${numPart}`;
                const newEntry = entry.replace(`[${issueKey}]`, `[${newKey}]`);
                toReroute.push({ severity: targetSeverity, entry: newEntry });
            }
        }

        // Re-insert into the correct arrays
        for (const { severity, entry } of toReroute) {
            if (severity === 'E') {
                context.errors.push(entry);
            } else {
                // 'W' and 'S' both live in context.warnings
                context.warnings.push(entry);
            }
        }
    }

    processArray(context.errors);
    processArray(context.warnings);

    return context;
}

// ---------------------------------------------------------------------------
// Main postprocessing orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs all postprocessing tasks sequentially.
 * Each task receives the full context and may modify errors, warnings,
 * suggestions, and infos before the results are returned to the caller.
 *
 * @param {object} context - The checker context
 * @returns {object} The context after all postprocessing tasks have run
 */
function postprocessing(context) {
    console.log('\n[postprocessing] running postprocessing tasks');

    adaptSeverity4New(context);

    return context;
}

exports.postprocessing = postprocessing;

'use strict';
/*
    This module contains postprocessing tasks for iobroker.repochecker.

    Postprocessing tasks are run after all check modules have completed and
    can manipulate errors, warnings, suggestions, and infos in the context.

*/

const common = require('./common.js');

// ---------------------------------------------------------------------------
// Configuration tables
// ---------------------------------------------------------------------------

/**
 * Per-adapter issue filter table (used by filterIssuesByAdapter).
 *
 * Key   : adapter name without the "ioBroker." prefix and without owner,
 *         e.g. 'backitup'.
 * Value : array of issue text patterns to suppress for that adapter.
 *         Each pattern is matched against the full issue string.
 *         The wildcard character '*' may appear anywhere in the pattern
 *         and matches any sequence of characters (including the empty string).
 *
 * Example entry:
 *   backitup: [
 *     '[E5050] process.exit() used in * (lib/restore.js)*',
 *   ],
 */
const filterByAdapter = {
    // eslint-disable-next-line prettier/prettier
    backitup: [
        '[E5050] process.exit() used in * (lib/restore.js)*',
    ],
};

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
    W0063: 'E', // [W0063] "@types/mocha, mocha, @types/sinon, sinon"
    W0028: 'E', // [W0028] Minimum node.js version 22 recommended.
    W0040: 'E', // [W0040] "keywords" within package.json should contain "ioBroker"
    W1027: 'E', // [W1027] Missing suggested translation into ru,pt,nl,fr,it,es,pl,uk,zh-cn of "common.titleLang"
    W1032: 'E', // [W1032] Many "common.news" found in io-package.json
    W1034: 'E', // [W1034] Missing suggested translation into ru,pt,nl,fr,it,es,pl,uk,zh-cn of "common.desc"
    W1054: 'E', // [W1054] Missing suggested translation into ru,pt,nl,fr,it,es,pl,uk,zh-cn of some "common.news" in io-package.json.
    W1056: 'E', // [W1056] admin 7.6.17 listed as dependency but 7.6.20 is reW1commended.
    W0078: 'E', // [W0078] Remove obsolete devDependencies @typescript-eslint/eslint-plugin, @typescript-eslint/parser, eslint when using "@iobroker/eslint-config".
    W1084: 'E', // [W1084] "common.title" is deprecated and replaced by "common.titleLang".
    W2007: 'E', // [W2007] Version 0.7.0-beta.2 is tagged as "latest" at npm
    W3009: 'E', // [W3009] Workflow "test-and-release.yml" is missing recommended concurrency configuration.
    S3014: 'E', // [S3014] Workflow "test-and-release.yml": job "adapter-tests" should declare "needs: check-and-lint" to run after linting.
    W3019: 'E', // [W3019] Workflow "test-and-release.yml": job "deploy" step using "ioBroker/testing-action-deploy@v1" has "npm-token" parameter specified. Trusted publishing will not work while "npm-token" is set.
    W3027: 'E', // [W3027] Workflow "test-and-release.yml": job "adapter-tests" OS matrix is missing: windows-latest, macos-latest. Consider adding tests for all of: ubuntu-latest, windows-latest, macos-latest
    W5018: 'E', // [W5018] "@alcalzone/release-script" (>=3.0.0) is used, but ".releaseconfig.json" not found. Please create.',
    W5512: 'E', // [W5512] admin/jsonConfig.json schema validation error: ...
    W5612: 'E', // W5612] "admin/jsonConfig.json/items/..." attribute "label" uses key "..." which is not found in the English translation file at "admin/i18n/en".
    W6020: 'E', // [W6020] Consider adding a CHANGELOG_OLD.md file to store older changelog entries.
    W6021: 'E', // [W6021] "## License" is not the last section in README.md.
    W8915: 'E', // [W8915] Dependabot npm entry (directory: "/") has no "cooldown" configured.
    W8916: 'E', // [W8916] Dependabot configuration "/.github/dependabot.yml" has no entry with "package-ecosystem: github-actions".
    W8917: 'E', // [W8917] At least major versions of @types/node should not be updated by dependabot.
    S0062: 'W', // [S0062] Consider adding and using package "@alcalzone/release-script".
    S2008: 'E', // [S2008] Version 0.5.1 tagged as "latest" at npm is not signed with provenance. Trusted publishing is recommended.
    S3012: 'E', // [S3012] Workflow "test-and-release.yml": job "deploy" is not defined.
    W3032: 'E', // [W3032] Just for Info: No workflow run for "test-and-release.yml" triggered by tag "v0.1.1" was found for current release 0.1.1. Workflow logs might be deleted already.
    S3032: 'E', // [S3032] Just for Info: No workflow run for "test-and-release.yml" triggered by tag "v0.1.1" was found for current release 0.1.1. Workflow logs might be deleted already.
    S3042: 'W', // [S3042] Workflow "test-and-release.yml": job "check-and-lint" uses "ioBroker/testing-action-check@v2.0.0" with a pinned version. Consider locking only the major version "@v2" instead.
    S5004: 'E', // [S5004] Plain setInterval() found in source files (lib/legacy/states.js, lib/zbDeviceAvailability.js, ...). Please use this.setInterval() or adapter.setInterval() instead.
    S5005: 'E', // [S5005] Plain setTimeout() found in source files (lib/localConfig.js, lib/networkmap.js, ...). Please use this.setTimeout() or adapter.setTimeout() instead.
    S5022: 'W', // [S5022] Please consider migrating to admin 5 UI (jsonConfig) or react based UI.
    S5043: 'E', // [S5043] Package "xx" is a built-in Node.js module. Please use "node:fs" instead.
    S5051: 'W', // [S5051] Custom sleep/wait function(s) found in source files (src/lib/adsb.ts).
    W5604: 'E', // [W5604] i18n "admin/i18n" language "de" is missing 4 key(s) present in English: Abfrageintervall (Sekunden),
    W5606: 'E', // [W5606] i18n "admin/i18n" language "nl" has 169 translation(s) identical to English (i.e. baseConfiguration). This may indicate untranslated content.
    W5611: 'E', // [W5611] "admin/jsonConfig.json/items/tab_region/items/country/options[0]" attribute "label" is missing language "uk" in i18n object.
    S6008: 'E', // [S6008] Changelog for version 0.7.0-beta.19 should be added to README.md
    S6020: 'W', // [S6020] Consider adding a CHANGELOG_OLD.md file to store older changelog entries. This is supported by @alcalzone/releasescript.
    S6022: 'E', // [S6022] CHANGELOG_OLD.md exists but no link to it was found in README.md. Consider adding a link to CHANGELOG_OLD.md at the end of the Changelog section.    S8901: 'W', // [S8901] Dependabot configuration file ".github/dependabot.yml" not found. Consider adding dependabot to keep dependencies up to date.
    S9006: 'E', // [S9006] .commitinfo file should be excluded by .gitignore, please add a line with text ".commitinfo" to .gitignore

};

// ---------------------------------------------------------------------------
// Postprocessing tasks
// ---------------------------------------------------------------------------

/**
 * Tests whether a single issue string matches a filter pattern.
 * The pattern may contain '*' as a wildcard that matches any sequence of
 * characters (including the empty string). All other characters are treated
 * as literals.
 *
 * @param {string} issue   - The full issue text to test
 * @param {string} pattern - The pattern, optionally containing '*' wildcards
 * @returns {boolean} true if the issue matches the pattern
 */
function matchesPattern(issue, pattern) {
    // Split on '*' so each segment can be escaped independently, then
    // rejoin with '.*' to form a full-match regular expression.
    const segments = pattern.split('*');
    const regexStr = segments.map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    const regex = new RegExp('^' + regexStr + '$');
    return regex.test(issue);
}

/**
 * Removes issues from context.errors and context.warnings that match any
 * filter pattern defined for the current adapter in filterByAdapter.
 *
 * If context.adapterName is not set, or no entry exists for that adapter
 * in filterByAdapter, the function returns immediately without changes.
 *
 * For every removed issue an info message is logged via common.info().
 * If at least one issue was removed a summary suggestion
 * "[S0000] Info: ### issues ignored for this adapter." is appended to
 * context.warnings (where ### is the count of removed issues).
 *
 * @param {object} context - The checker context
 * @returns {object} The (possibly modified) context
 */
function filterIssuesByAdapter(context) {
    const adapterName = context.adapterName;
    if (!adapterName) {
        return context;
    }

    const patterns = filterByAdapter[adapterName];
    if (!patterns || patterns.length === 0) {
        return context;
    }

    let removedCount = 0;

    /**
     * Scan one issue array in-place and remove entries matching any pattern.
     *
     * @param {string[]} arr - context.errors or context.warnings
     */
    function filterArray(arr) {
        for (let i = arr.length - 1; i >= 0; i--) {
            const issue = arr[i];
            for (const pattern of patterns) {
                if (matchesPattern(issue, pattern)) {
                    common.info(
                        `[postprocessing] filterIssuesByAdapter: removed issue for adapter "${adapterName}": ${issue}`,
                    );
                    arr.splice(i, 1);
                    removedCount++;
                    break; // no need to check further patterns for this issue
                }
            }
        }
    }

    filterArray(context.errors);
    filterArray(context.warnings);

    if (removedCount > 0) {
        common.info(
            `[postprocessing] filterIssuesByAdapter: ${removedCount} issue(s) ignored for adapter "${adapterName}".`,
        );
        context.warnings.push(`[S0000] Info: ${removedCount} issue(s) ignored for this adapter.`);
    }

    return context;
}

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
    filterIssuesByAdapter(context);

    return context;
}

exports.postprocessing = postprocessing;

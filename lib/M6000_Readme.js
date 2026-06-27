'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   README file
    Numbering   :   6000 - 6999

*/

const execSync = require('node:child_process').execSync;

const common = require('./common.js');

// German language words blacklist - add new words here to extend detection
const GERMAN_WORDS = [
    'Alarmierung',
    'Beispiel',
    'bis',
    'blockiert',
    'das',
    'der',
    'die',
    'dieser Adapter',
    'Einstellung',
    'Einstellungen',
    'Entwickelt mit Unterstützung von',
    'Funktion',
    'Funktionen',
    'Gerät',
    'Geräte',
    'Geräte-Konfiguration',
    'Gerätekonfiguration',
    'hinzufügen',
    'ist',
    'Konfiguration',
    'Netzwerk',
    'nicht',
    'Oberfläche',
    'Störung',
    'Störungen',
    'technische Störung',
    'über',
    'Unterstützung',
    'vollständig',
    'von',
    'Voraussetzung',
    'Voraussetzungen',
    'Wertebereich',
    'Zeitfenster',
];

// Common English words used to verify if README is written in English
const ENGLISH_WORDS = [
    'and',
    'are',
    'configuration',
    'description',
    'device',
    'devices',
    'example',
    'fetch',
    'fetches',
    'for',
    'from',
    'if',
    'install',
    'is',
    'not',
    'please',
    'supported',
    'supports',
    'that',
    'the',
    'this',
    'with',
    'you',
];

// Minimum number of distinct English words that must be found to consider the text English
const ENGLISH_WORD_THRESHOLD = 5;

// Minimum number of distinct German words that must be detected before raising an error
const GERMAN_WORD_DETECTION_LIMIT = 3;

// Keep this text in sync with the exact README wording required for adapters using the Sentry plugin.
const SENTRY_NOTICE_TEXT_1 =
    'This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.';
const SENTRY_NOTICE_TEXT_2 =
    'This adapter uses the service `Sentry.io` to automatically report exceptions and code errors';
const SENTRY_NOTICE_TEXT_3 =
    'This adapter employs Sentry libraries to automatically report exceptions and code errors to the developers.';
const MARKDOWN_H1_REGEX = /^#\s+.+$/gm;
const MARKDOWN_H2_REGEX = /^##\s+.+$/gm;
const THIRD_H2_HEADER_INDEX = 4;

/**
 * Search for all German words from the blacklist in the given text.
 * Returns an array of all matching words (in detection order).
 *
 * @param {string} text - The text to analyze
 * @returns {string[]} Array of German words found (empty if none)
 */
function findAllGermanWords(text) {
    const found = [];
    for (const word of GERMAN_WORDS) {
        if (word.includes(' ')) {
            // For phrases, use case-insensitive substring match
            if (text.toLowerCase().includes(word.toLowerCase())) {
                found.push(word);
            }
        } else {
            // Use lookbehind/lookahead for whole-word matching.
            // Note: \w only matches ASCII [a-zA-Z0-9_], which is intentional here:
            // it correctly handles German umlauts at word starts (e.g. 'über' in 'übermäßig'
            // won't match because 'm' after 'r' is an ASCII \w char).
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?<!\\w)${escaped}(?!\\w)`);
            if (regex.test(text)) {
                found.push(word);
            }
        }
    }
    return found;
}

/**
 * Get a short context snippet (up to 3 words) centred on the detected word in the text.
 *
 * @param {string} text - The text to search in
 * @param {string} word - The word to find context for
 * @returns {string} A snippet with one word before and one word after the detected word
 */
function getWordContext(text, word) {
    let matchIndex;
    let matchLength;

    if (word.includes(' ')) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp(escaped, 'i').exec(text);
        if (!match) {
            return word;
        }
        matchIndex = match.index;
        matchLength = match[0].length;
    } else {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp(`(?<!\\w)${escaped}(?!\\w)`).exec(text);
        if (!match) {
            return word;
        }
        matchIndex = match.index;
        matchLength = match[0].length;
    }

    const before = text.substring(0, matchIndex).trimEnd().split(/\s+/);
    const matchedWord = text.substring(matchIndex, matchIndex + matchLength);
    const after = text
        .substring(matchIndex + matchLength)
        .trimStart()
        .split(/\s+/);

    const parts = [];
    if (before.length > 0 && before[before.length - 1]) {
        parts.push(before[before.length - 1]);
    }
    parts.push(matchedWord);
    if (after.length > 0 && after[0]) {
        parts.push(after[0]);
    }

    return parts.join(' ');
}

/**
 * Remove a markdown chapter (header + all content until the next header of the same or higher level)
 * that matches the given title. The comparison is case-insensitive.
 * Used to exclude chapters such as "Haftungsausschluss" from language detection.
 *
 * @param {string} text - The markdown text to process
 * @param {string} title - The chapter title to remove (case-insensitive)
 * @returns {string} The text with the specified chapters removed
 */
function stripChapterByTitle(text, title) {
    const lines = text.split('\n');
    const result = [];
    let skipLevel = 0;

    for (const line of lines) {
        const headerMatch = line.match(/^(#{1,6})\s+(.*?)\s*$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            if (headerMatch[2].trim().toLowerCase() === title.toLowerCase()) {
                // Start skipping this chapter
                skipLevel = level;
                continue;
            }
            if (skipLevel > 0 && level <= skipLevel) {
                // Stop skipping at same or higher-level header
                skipLevel = 0;
            }
        }
        if (skipLevel === 0) {
            result.push(line);
        }
    }

    return result.join('\n');
}

/**
 * Strip markdown elements that are not visible to the user when the markdown is rendered.
 * This prevents false positives in language detection when German words appear in:
 * - fenced code blocks (``` ... ```)
 * - inline code (`...`)
 * - blockquote lines (lines starting with >)
 * - link URLs [text](url) — the URL part is stripped, the visible text is kept
 * - image markup ![alt](url) — stripped entirely (alt text and URL are both not rendered as prose)
 * - chapters with title "Haftungsausschluss" (disclaimer sections in German)
 *
 * @param {string} text - The markdown text to process
 * @returns {string} The text with non-visible parts removed
 */
function stripMarkdownForLanguageDetection(text) {
    // Remove chapters titled "Haftungsausschluss" (German disclaimer sections)
    text = stripChapterByTitle(text, 'Haftungsausschluss');
    // Remove fenced code blocks (``` ... ```) including those with a language hint (```js ... ```)
    text = text.replace(/```[\s\S]*?```/g, '');
    // Remove inline code (`...`)
    text = text.replace(/`[^`\n]*`/g, '');
    // Remove blockquote lines (lines starting with optional whitespace then >)
    text = text.replace(/^[ \t]*>.*$/gm, '');
    // Remove image markup entirely: ![alt text](url) and ![alt text][ref]
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, '');
    // For links [text](url) and [text][ref], keep only the visible link text
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
    return text;
}

/**
 * Strip markdown inline formatting for install-instruction text scanning.
 * Removes fenced/inline code blocks, expands links to "text URL" so that URL
 * checks still work, and removes bold/italic emphasis markers so that formatted
 * text like `install from **[GitHub](url)**` is still detected.
 *
 * @param {string} text - Raw markdown text
 * @returns {string} Text with inline formatting stripped
 */
function stripMarkdownInlineFormatting(text) {
    // Remove fenced code blocks (``` ... ```)
    text = text.replace(/```[\s\S]*?```/g, '');
    // Remove inline code (`...`)
    text = text.replace(/`[^`\n]*`/g, '');
    // Expand links [text](url) -> "text url" (preserve both visible text and URL for checks)
    text = text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2');
    // Remove bold+italic (***) and bold (**) markers
    text = text.replace(/\*{2,3}/g, '');
    // Remove bold+italic (___) and bold (__) markers
    text = text.replace(/_{2,3}/g, '');
    return text;
}

/**
 * Check if text is written in English by counting distinct common English words found.
 *
 * @param {string} text - The text to analyze
 * @returns {boolean} True if text appears to be written in English
 */
function isEnglishText(text) {
    const foundCount = ENGLISH_WORDS.filter(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return regex.test(text);
    }).length;
    return foundCount >= ENGLISH_WORD_THRESHOLD;
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Allow flexible whitespace so the required notice still matches if it is wrapped across lines in README.md.
const SENTRY_NOTICE_REGEX_1 = new RegExp(escapeRegExp(SENTRY_NOTICE_TEXT_1).replace(/\s+/g, '\\s+'));
const SENTRY_NOTICE_REGEX_2 = new RegExp(escapeRegExp(SENTRY_NOTICE_TEXT_2).replace(/\s+/g, '\\s+'));
const SENTRY_NOTICE_REGEX_3 = new RegExp(escapeRegExp(SENTRY_NOTICE_TEXT_3).replace(/\s+/g, '\\s+'));

function getSentryNoticeMatch(text) {
    return SENTRY_NOTICE_REGEX_1.exec(text) || SENTRY_NOTICE_REGEX_2.exec(text) || SENTRY_NOTICE_REGEX_3.exec(text);
}

function getAuthor(author) {
    if (author && typeof author === 'object') {
        return `${author.name} <${author.email}>`;
    }
    return author;
}

/**
 * Extract all years from a text and return the maximum year found.
 * This handles multiple copyright entries correctly.
 *
 * @param {string} text - The text to search for years
 * @returns {number} The maximum year found, or 0 if no year found
 */
function getMaxYearFromText(text) {
    const allYears = [];
    const yearRegex = /\b(\d\d\d\d)\b/g;
    let match;
    while ((match = yearRegex.exec(text)) !== null) {
        allYears.push(Number(match[0]));
    }
    return allYears.length > 0 ? Math.max(...allYears) : 0;
}

function findLicenseHeaderMatch(text) {
    return /^##[ \t]+license[ \t]*$/im.exec(text);
}

function findH2Section(text, sectionName) {
    const escapedSectionName = escapeRegExp(sectionName);
    const headerRegex = new RegExp(`^##[ \\t]+${escapedSectionName}[ \\t]*$`, 'im');
    const headerMatch = headerRegex.exec(text);
    if (!headerMatch) {
        return '';
    }

    const sectionStart = headerMatch.index + headerMatch[0].length;
    const sectionTail = text.slice(sectionStart);
    const nextHeaderMatch = /^##[ \t]+/m.exec(sectionTail);
    const sectionEnd = nextHeaderMatch ? sectionStart + nextHeaderMatch.index : text.length;
    return text.slice(sectionStart, sectionEnd).replace(/^\r?\n/, '');
}

function normalizeVersion(version) {
    return (version || '').trim().replace(/^v/i, '');
}

// Adapters that are allowed to have a CHANGELOG.md instead of keeping the changelog in README.md
const CHANGELOG_MD_ALLOW_LIST = ['js-controller', 'admin'];

// Maximum number of changelog entries in README before a warning is issued about CHANGELOG_OLD.md
const MAX_README_CHANGELOG_ENTRIES = 30;

async function checkReadme(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/README.md
    console.log('\n[E6000 - E6999] checkReadme');

    // Get the list of files to check for CHANGELOG.md and CHANGELOG_OLD.md
    const filesList = await common.getFilesList(context);
    const hasChangelogMd = filesList.some(f => f.toLowerCase() === '/changelog.md');
    const hasChangelogOldMd = filesList.some(f => f.toLowerCase() === '/changelog_old.md');

    const data = await common.getFile(context, '/README.md');
    if (!data) {
        context.errors.push('[E6001] No README.md found');
    } else {
        context.checks.push('README.md found');
        const h1Headers = [...data.matchAll(MARKDOWN_H1_REGEX)];
        if (h1Headers.length !== 1) {
            context.errors.push(
                `[E6025] README.md must contain exactly one H1 heading, but found ${h1Headers.length}.`,
            );
        } else {
            context.checks.push('README.md contains exactly one H1 heading');
        }

        const sentryPluginConfigured =
            context.ioPackageJson?.common?.plugins &&
            typeof context.ioPackageJson.common.plugins === 'object' &&
            Object.prototype.hasOwnProperty.call(context.ioPackageJson.common.plugins, 'sentry');
        if (sentryPluginConfigured) {
            const sentryNoticeMatch = getSentryNoticeMatch(data);
            if (!sentryNoticeMatch) {
                context.warnings.push(
                    '[W6023] Sentry plugin is configured in io-package.json but the required Sentry information was not found in README.md. Please add the standard Sentry notice near the top of README.md.',
                );
            } else {
                context.checks.push('README.md contains the required Sentry information');

                const levelTwoHeaders = [...data.matchAll(MARKDOWN_H2_REGEX)];
                if (
                    levelTwoHeaders.length > THIRD_H2_HEADER_INDEX &&
                    sentryNoticeMatch.index > levelTwoHeaders[THIRD_H2_HEADER_INDEX].index
                ) {
                    context.warnings.push(
                        '[W6024] README.md contains the Sentry information, but it is located too far down in the document. Please move it near the top of README.',
                    );
                } else {
                    context.checks.push('Sentry information is located near the top of README.md');
                }
            }
        }

        const changelogSection = findH2Section(data, 'changelog');
        if (!/^##[ \t]+changelog[ \t]*$/im.test(data)) {
            context.errors.push('[E6003] NO "## Changelog" found in README.md');
        } else {
            context.checks.push('README.md contains Changelog');
            const changelogHeaders = [...changelogSection.matchAll(/^###\s+(.+)$/gm)].map(match => match[1].trim());
            const changelogVersions = [];

            if (changelogHeaders.length === 0) {
                context.errors.push(
                    '[E6026] Changelog section in README.md contains no "###" entries. The newest changes must be documented in README changelog using the standard format.',
                );
            } else {
                context.checks.push('README.md changelog contains "###" entries');
                const invalidVersionHeaders = [];
                for (const header of changelogHeaders) {
                    const match = /^(\d+\.\d+\.\d+(-\w+\.\d+)?)(?:\s+.*)?$/.exec(header);
                    if (!match) {
                        if (
                            !header.includes('WORK IN PROGRESS') &&
                            !header.includes('CHANGELOG_OLD.md') &&
                            !header.toLowerCase().includes('older versions') &&
                            !header.toLowerCase().includes('older changelog')
                        ) {
                            invalidVersionHeaders.push(header);
                        }
                    } else {
                        changelogVersions.push(normalizeVersion(match[1]));
                    }
                }
                if (invalidVersionHeaders.length) {
                    context.warnings.push(
                        `[W6028] Changelog entry header(s) do not match required version format "x.y.z": ${invalidVersionHeaders.join(', ')}`,
                    );
                } else {
                    context.checks.push('All changelog "###" headers use valid version format');
                }
            }

            //if (!/^\s*[-*]\s+\([^)]+\)\s+.+$/m.test(changelogSection)) {
            if (!/^\s*[-*]\s+.+$/m.test(changelogSection)) {
                context.warnings.push(
                    '[W6027] Changelog section in README.md should contain at least one entry in format "- text" or "* text".',
                );
            } else {
                context.checks.push('README.md changelog contains at least one standard bullet entry');
            }

            const latestNpmVersion = normalizeVersion(context.npmLatestVersion);
            if (latestNpmVersion && !changelogVersions.includes(latestNpmVersion)) {
                context.errors.push(
                    `[E6029] Changelog section in README.md has no entry for npm latest version ${latestNpmVersion}.`,
                );
            } else if (latestNpmVersion) {
                context.checks.push(`README.md changelog contains npm latest version ${latestNpmVersion}`);
            }

            const currentIoPackageVersion = normalizeVersion(context.ioPackageJson?.common?.version);
            if (currentIoPackageVersion && !changelogVersions.includes(currentIoPackageVersion)) {
                context.warnings.push(
                    `[W6030] Changelog section in README.md should contain an entry for io-package.json version ${currentIoPackageVersion}.`,
                );
            } else if (currentIoPackageVersion) {
                context.checks.push(`README.md changelog contains io-package.json version ${currentIoPackageVersion}`);
            }

            // some changelogs might be moved into CHANGELOG_OLD already...
            // const newsVersions = Object.keys(context.ioPackageJson?.common?.news || {}).map(normalizeVersion);
            // const missingNewsVersions = newsVersions.filter(version => version && !changelogVersions.includes(version));
            // if (missingNewsVersions.length > 0) {
            //     context.errors.push(
            //         `[E6031] Changelog section in README.md is missing entry/entries for version(s) from io-package.json news: ${missingNewsVersions.join(', ')}.`,
            //     );
            // } else if (newsVersions.length > 0) {
            //     context.checks.push('README.md changelog contains all versions from io-package.json news');
            // }

            if (/\[[^\]]*changelog[^\]]*\]\([^)\n]*changelog\.md[^)\n]*\)/i.test(changelogSection)) {
                context.warnings.push(
                    '[W6032] Changelog section in README.md appears to use a fixed link to CHANGELOG.md. Keep changelog entries directly in README.md.',
                );
            }

            const versionEntryCount = changelogHeaders.length;

            if (!hasChangelogOldMd) {
                if (versionEntryCount > MAX_README_CHANGELOG_ENTRIES) {
                    context.warnings.push(
                        `[W6019] README.md contains ${versionEntryCount} changelog entries. Consider adding CHANGELOG_OLD.md file supported by @alcalzone/releasescript.`,
                    );
                } else if (context.cfg.isNewAdapter || common.isStrict()) {
                    context.warnings.push(
                        '[S6020] Consider adding a CHANGELOG_OLD.md file to store older changelog entries. This is supported by @alcalzone/releasescript.',
                    );
                }
            } else {
                context.checks.push('CHANGELOG_OLD.md found');
                if (!data.includes('CHANGELOG_OLD.md')) {
                    context.warnings.push(
                        '[S6022] CHANGELOG_OLD.md exists but no link to it was found in README.md. Consider adding a link to CHANGELOG_OLD.md at the end of the Changelog section.',
                    );
                } else {
                    context.checks.push('README.md contains link to CHANGELOG_OLD.md');
                }
            }
        }

        let npmYear = 0;
        if (context.cfg.npmExists) {
            try {
                const result = execSync(`npm view iobroker.${context.adapterName} --json`, { encoding: 'utf-8' });
                const npmJson = JSON.parse(result);
                //console.log(`[DEBUG] ${JSON.stringify(npmJson)}`);
                if (npmJson['dist-tags'] && npmJson['dist-tags'].latest) {
                    const latest = npmJson['dist-tags'].latest;
                    const timeStr = npmJson.time[latest];
                    npmYear = new Date(timeStr).getFullYear();
                    // console.log(`${latest} - ${timeStr} - ${npmYear}`);
                }
            } catch (e) {
                context.warnings.push('[W6010] Could not retrieve timestamp of LATEST revision at npm.');
                common.error(`executing "npm view" - ${e}`);
            }
        }

        const licenseHeaderMatch = findLicenseHeaderMatch(data);
        if (!licenseHeaderMatch) {
            context.errors.push('[E6004] No "## License" found in README.md');
        } else {
            const pos = licenseHeaderMatch.index;
            context.checks.push('## License found in README.md');
            const text = data.substring(pos);
            const year = new Date().getFullYear();
            const commitYear = context.lastCommitYear || 0;
            const readmeYear = getMaxYearFromText(text);

            if (!/^Copyright\s+\(c\)\s+\d{4}(?:-\d{4})?,?\s+.+$/im.test(text)) {
                context.errors.push(
                    '[E6033] "## License" section in README.md must contain a copyright line like "Copyright (c) 2026 iobroker-community-adapters".',
                );
            } else {
                context.checks.push('README.md license section contains a copyright line');
            }

            common.info(
                `years detected: README ${readmeYear} / Current ${year} / Last commit ${commitYear} / NPM ${npmYear}`,
            );

            const valid = readmeYear === year || readmeYear >= commitYear || readmeYear >= npmYear;
            if (readmeYear > year) {
                const m = text.match(/(\d\d\d\d)-\d\d\d\d/);
                if (m) {
                    context.errors.push(
                        `[E6007] Future year (${readmeYear}) found in copyright at README.md. Please use "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at start of LICENSE section.`,
                    );
                } else {
                    context.errors.push(
                        `[E6007] Future year (${readmeYear}) found in copyright at README.md. Please use "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at start of LICENSE section.`,
                    );
                }
            } else if (!valid) {
                const m = text.match(/(\d\d\commitd\d)-\d\d\d\d/);
                if (m) {
                    context.errors.push(
                        `[E6005] No actual year found in copyright at README.md. Please add "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at start of LICENSE section.`,
                    );
                } else {
                    context.errors.push(
                        `[E6005] No actual year found in copyright at README.md. Please add "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at start of LICENSE section.`,
                    );
                }
            } else {
                context.checks.push('Valid copyright year found in README.md');
            }

            // Check for consecutive copyright lines and trailing spaces
            // Only consecutive copyright lines (no other text or empty line between them) require trailing spaces
            const readmeLines = text.split('\n');
            const linesWithoutTrailingSpaces = [];
            let hasConsecutiveCopyrightLines = false;
            const emptyLineBetweenCopyrightLines = [];
            for (let i = 0; i < readmeLines.length - 1; i++) {
                if (
                    readmeLines[i].trim().match(/^Copyright\s+\(c\)/i) &&
                    readmeLines[i + 1].trim().match(/^Copyright\s+\(c\)/i)
                ) {
                    hasConsecutiveCopyrightLines = true;
                    if (!readmeLines[i].match(/\s{2,}$/)) {
                        linesWithoutTrailingSpaces.push(i + 1);
                    }
                }
                // Check for copyright lines separated by a single empty line
                if (
                    i < readmeLines.length - 2 &&
                    readmeLines[i].trim().match(/^Copyright\s+\(c\)/i) &&
                    readmeLines[i + 1].trim() === '' &&
                    readmeLines[i + 2].trim().match(/^Copyright\s+\(c\)/i)
                ) {
                    emptyLineBetweenCopyrightLines.push(i + 2);
                }
            }
            if (hasConsecutiveCopyrightLines) {
                if (linesWithoutTrailingSpaces.length > 0) {
                    context.warnings.push(
                        `[W6009] Multiple copyright lines found in README.md but line(s) ${linesWithoutTrailingSpaces.join(', ')} missing trailing spaces. Add two spaces at end of each copyright line (except last) for proper formatting.`,
                    );
                } else {
                    context.checks.push('Multiple copyright lines in README.md have proper trailing spaces');
                }
            }
            if (emptyLineBetweenCopyrightLines.length > 0) {
                context.warnings.push(
                    `[W6011] Copyright lines in README.md are separated by empty line(s) at line(s) ${emptyLineBetweenCopyrightLines.join(', ')}. Remove the empty line(s) between copyright lines and terminate each line (except last) with two spaces.`,
                );
            }

            // Check that ## License is the last ## section in README.md
            const textAfterLicense = data.substring(pos + licenseHeaderMatch[0].length);
            if (/\n## [^#]/.test(textAfterLicense)) {
                context.warnings.push(
                    '[W6021] "## License" is not the last section in README.md. The license section should be the last section.',
                );
            } else {
                context.checks.push('"## License" is the last section in README.md');
            }
        }

        // Strip markdown inline formatting so that bold/italic-wrapped install instructions
        // (e.g. `install from **[GitHub](url)**`) are still detected by the checks below.
        const dataForInstallCheck = stripMarkdownInlineFormatting(data);

        // Check for direct npm install instructions
        const npmInstallRegex = /(?:^|\n)[^\n]*(?:npm\s+install|npm\s+i)\s+iobroker\.[^\s\n]*/i;
        const cdIoBrokerRegex = /(?:^|\n)[^\n]*cd\s+\/opt\/iobroker/i;
        if (npmInstallRegex.test(dataForInstallCheck) || cdIoBrokerRegex.test(dataForInstallCheck)) {
            context.errors.push(
                '[E6012] README.md suggests to install using direct npm commands. Adapters must not be installed using direct npm commands. Please remove these instructions.',
            );
        } else {
            context.checks.push('README.md does not contain direct npm install instructions');
        }

        // Check for iobroker url (github) install instructions or other undesired install methods
        const repoOwner = (context.repository || '').split('/')[0];
        const escapedOwner = repoOwner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedAdapterName = (context.adapterName || 'unknown').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const ownerAdapterPattern = `${escapedOwner}\\/iobroker\\.${escapedAdapterName}`;
        if (
            // iobroker/iob url commands (with or without https://github.com/ prefix)
            new RegExp(
                `(?:^|\\n)[^\\n]*(?:iobroker|iob)\\s+url\\s+(?:https?:\\/\\/github\\.com\\/)?${ownerAdapterPattern}`,
                'i',
            ).test(dataForInstallCheck) ||
            // Install from custom URL
            new RegExp(`install\\s+from\\s+custom\\s+url`, 'i').test(dataForInstallCheck) ||
            // Installation via Github Cat possible.
            new RegExp(`installation\\s+via\\s+github`, 'i').test(dataForInstallCheck) ||
            // iobroker/iob npm install commands with owner/repo GitHub shorthand
            new RegExp(`(?:^|\\n)[^\\n]*(?:iobroker|iob)\\s+npm\\s+install\\s+${ownerAdapterPattern}`, 'i').test(
                dataForInstallCheck,
            ) ||
            // npm install/i with owner/repo GitHub shorthand
            new RegExp(`(?:^|\\n)[^\\n]*npm\\s+(?:install|i)\\s+${ownerAdapterPattern}`, 'i').test(
                dataForInstallCheck,
            ) ||
            // Generic iobroker url https://github.com (fallback for any GitHub URL)
            /(?:^|\n)[^\n]*iobroker\s+url\s+https:\/\/github\.com\//i.test(dataForInstallCheck) ||
            /install\s+the\s+adapter\s+via\s+iobroker\s+admin\s+as\s+a\s+zip\s+file/i.test(dataForInstallCheck) ||
            /install\s+from\s+own\s+url/i.test(dataForInstallCheck) ||
            // Install from a GitHub URL (e.g. `install from **[GitHub](https://github.com/...)**`)
            /install\s+from\s+(?:\S+\s+)?https?:\/\/github\.com\//i.test(dataForInstallCheck)
        ) {
            context.errors.push(
                '[E6013] README.md suggests to install the adapter directly from GitHub, directly from npm or using npm commands. Installation from GitHub is discouraged. Please remove these instructions.',
            );
        } else {
            context.checks.push('README.md does not contain GitHub URL install instructions');
        }

        // do not suggest to remove installation as several usefull install sections with additional infos exist.
        // // Check for ## Installation section
        // if (/^##\s+Installation\s*$/im.test(data)) {
        //     context.warnings.push(
        //         '[S6014] README.md section "## Installation" should be removed unless the adapter requires special installation handling.',
        //     );
        // } else {
        //     context.checks.push('README.md does not contain an unnecessary Installation section');
        // }

        // Check README language — strip non-visible markdown elements first so that
        // German words inside code blocks, blockquotes, link URLs or image markup
        // do not trigger false positives.
        const dataForLanguageCheck = stripMarkdownForLanguageDetection(data);
        const germanWords = findAllGermanWords(dataForLanguageCheck);
        if (germanWords.length >= GERMAN_WORD_DETECTION_LIMIT) {
            const snippet = getWordContext(dataForLanguageCheck, germanWords[0]);
            context.errors.push(
                `[E6015] README.md must use English language only but appears to contain German text (detected: "${snippet}"). Please remove or translate.`,
            );
        } else {
            context.checks.push('No German language detected in README.md');
            if (!isEnglishText(dataForLanguageCheck)) {
                context.warnings.push(
                    '[W6016] README.md does not appear to be written in English. README.md must be written using English language only. Please translate.',
                );
            } else {
                context.checks.push('README.md appears to be written in English');
            }
        }
    }

    // Check for CHANGELOG.md — changelog should be in README.md (some adapters are exempt)
    if (hasChangelogMd) {
        if (!CHANGELOG_MD_ALLOW_LIST.includes(context.adapterName)) {
            context.warnings.push('[W6017] CHANGELOG.md detected. The changelog must be located within README.md.');
        }
        if (hasChangelogOldMd) {
            context.warnings.push(
                '[W6018] Both CHANGELOG.md and CHANGELOG_OLD.md files were found. This need to be cleaned up.',
            );
        }
    }

    return context;
}

exports.checkReadme = checkReadme;

// List of error and warnings used at this module
// ----------------------------------------------

// [6001] No README.md found
// [6003] NO "## Changelog" found in README.md
// [6006] Current adapter version ${context.packageJson.version} not found in README.md
// [6004] No "## License" found in README.md
// [6005] No actual year found in copyright. Please add "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the end of README.md
// [6005] No actual year found in copyright. Please add "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at the end of README.md
// [6010] Could not retrieve timestamp of LATEST revision at npm.
// [6007] Future year (${readmeYear}) found in copyright. Please use "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the end of README.md
// [6008] Changelog for version ${context.packageJson.version} should be added to README.md.
// [6009] Multiple copyright lines found in README.md but line(s) ${linesWithoutTrailingSpaces.join(', ')} missing trailing spaces. Add two spaces at end of each copyright line (except last) for proper formatting.
// [6011] Copyright lines in README.md are separated by empty line(s) at line(s) ${emptyLineBetweenCopyrightLines.join(', ')}. Remove the empty line(s) between copyright lines and terminate each line (except last) with two spaces.
// [E6012] README.md contains instructions to install the adapter using direct npm commands. Adapters must not be installed using direct npm commands. Please remove these instructions.
// [E6013] README.md suggests to install the adapter directly from GitHub, directly from npm or using npm commands. Installation from GitHub is discouraged. Please remove these instructions.
// [S6014] README.md contains an "## Installation" section. Adapter installation is covered by standard ioBroker procedures. This section should be removed unless the adapter requires special installation handling.
// [E6015] README.md appears to be written in German (detected word: "..."). README.md must be written in English.
// [W6016] README.md does not appear to be written in English. README.md must be written in English.
// [W6017] A CHANGELOG.md file was found. The changelog should be located within README.md instead.
// [W6018] Both CHANGELOG.md and CHANGELOG_OLD.md files were found. Please check why both files exist.
// [W6019] README.md changelog contains ${versionEntryCount} entries. Please consider moving older entries to a separate CHANGELOG_OLD.md file, which is supported by @alcalzone/releasescript.
// [S6020] Consider adding a CHANGELOG_OLD.md file to store older changelog entries. This file is supported by @alcalzone/releasescript.
// [W6021] "## License" is not the last section in README.md. The license section should be the last section.
// [S6022] CHANGELOG_OLD.md exists but no link to it was found in README.md. Consider adding a link to CHANGELOG_OLD.md at the end of the Changelog section.
// [W6023] Sentry plugin is configured in io-package.json but the required Sentry information was not found in README.md. Please add the standard Sentry notice near the top of README.md.
// [W6024] README.md contains the Sentry information, but it is located too far down in the document. Please move it before the third "##" section.
// [E6025] README.md must contain exactly one H1 heading, but found N.
// [E6026] Changelog section in README.md contains no "###" entries. The newest changes must be documented in README changelog using the standard format.
// [E6027] Changelog section in README.md must contain at least one entry in format "- (xxx) text".
// [W6028] Changelog entry header(s) do not match required version format "x.y.z": ${invalidVersionHeaders.join(', ')}
// [E6029] Changelog section in README.md has no entry for npm latest version ${latestNpmVersion}.
// [W6030] Changelog section in README.md should contain an entry for io-package.json version ${currentIoPackageVersion}.
// [E6031] Changelog section in README.md is missing entry/entries for version(s) from io-package.json news: ${missingNewsVersions.join(', ')}.
// [W6032] Changelog section in README.md appears to use a fixed link to CHANGELOG.md. Keep changelog entries directly in README.md.
// [E6033] "## License" section in README.md must contain a copyright line like "Copyright (c) 2026 iobroker-community-adapters".

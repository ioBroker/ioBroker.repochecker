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

// Adapters that are allowed to have a CHANGELOG.md instead of keeping the changelog in README.md
const CHANGELOG_MD_ALLOW_LIST = ['js-controller', 'admin'];

// Maximum number of changelog entries in README before a warning is issued about CHANGELOG_OLD.md
const MAX_README_CHANGELOG_ENTRIES = 20;

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

        if (!data.includes('## Changelog')) {
            context.errors.push('[E6003] NO "## Changelog" found in README.md');
        } else {
            context.checks.push('README.md contains Changelog');

            if (!data.includes(`### ${context.packageJson.version}`)) {
                if (!common.isAlphaVersion(context.packageJson.version)) {
                    context.errors.push(
                        `[E6006] Current adapter version ${context.packageJson.version} not found in README.md`,
                    );
                } else {
                    context.warnings.push(
                        `[S6008] Changelog for version ${context.packageJson.version} should be added to README.md.`,
                    );
                }
            } else {
                context.checks.push('README.md contains current adapter version');
            }

            // Count the number of version entries (### headers) in the Changelog section
            const changelogStart = data.indexOf('## Changelog');
            const afterChangelog = data.substring(changelogStart + '## Changelog'.length);
            const nextSectionMatch = afterChangelog.match(/\n## /);
            const changelogSection = nextSectionMatch
                ? afterChangelog.substring(0, nextSectionMatch.index)
                : afterChangelog;
            const versionEntryCount = (changelogSection.match(/^###\s+/gm) || []).length;

            if (!hasChangelogOldMd) {
                if (versionEntryCount > MAX_README_CHANGELOG_ENTRIES) {
                    context.warnings.push(
                        `[W6019] README.md contains ${versionEntryCount} changelog entries. Consider adding CHANGELOG_OLD.md file supported by @alcalzone/releasescript.`,
                    );
                } else {
                    context.warnings.push(
                        '[S6020] Consider adding a CHANGELOG_OLD.md file to store older changelog entries. This is supported by @alcalzone/releasescript.',
                    );
                }
            } else {
                context.checks.push('CHANGELOG_OLD.md found');
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

        const pos = data.indexOf('## License');
        if (pos === -1) {
            context.errors.push('[E6004] No "## License" found in README.md');
        } else {
            context.checks.push('## License found in README.md');
            const text = data.substring(pos);
            const year = new Date().getFullYear();
            const commitYear = context.lastCommitYear || 0;
            const readmeYear = getMaxYearFromText(text);

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
        }

        // Check for direct npm install instructions
        const npmInstallRegex = /(?:^|\n)[^\n]*(?:npm\s+install|npm\s+i)\s+iobroker\.[^\s\n]*/i;
        const cdIoBrokerRegex = /(?:^|\n)[^\n]*cd\s+\/opt\/iobroker/i;
        if (npmInstallRegex.test(data) || cdIoBrokerRegex.test(data)) {
            context.errors.push(
                '[E6012] README.md suggests to install using direct npm commands. Adapters must not be installed using direct npm commands. Please remove these instructions.',
            );
        } else {
            context.checks.push('README.md does not contain direct npm install instructions');
        }

        // Check for iobroker url (github) install instructions or other undesired install methods
        if (
            /(?:^|\n)[^\n]*iobroker\s+url\s+https:\/\/github\.com\//i.test(data) ||
            /install\s+the\s+adapter\s+via\s+iobroker\s+admin\s+as\s+a\s+zip\s+file/i.test(data) ||
            /install\s+from\s+own\s+url/i.test(data)
        ) {
            context.errors.push(
                '[E6013] README.md suggests to install the adapter directly from GitHub. Installation from GitHub is discouraged. Please remove these instructions.',
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
            context.warnings.push(
                '[W6017] CHANGELOG.md detected. The changelog must be located within README.md.',
            );
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
// [E6013] README.md contains instructions to install the adapter directly from GitHub using "iobroker url". Installation from GitHub is discouraged. Please remove these instructions.
// [S6014] README.md contains an "## Installation" section. Adapter installation is covered by standard ioBroker procedures. This section should be removed unless the adapter requires special installation handling.
// [E6015] README.md appears to be written in German (detected word: "..."). README.md must be written in English.
// [W6016] README.md does not appear to be written in English. README.md must be written in English.
// [W6017] A CHANGELOG.md file was found. The changelog should be located within README.md instead.
// [W6018] Both CHANGELOG.md and CHANGELOG_OLD.md files were found. Please check why both files exist.
// [W6019] README.md changelog contains ${versionEntryCount} entries. Please consider moving older entries to a separate CHANGELOG_OLD.md file, which is supported by @alcalzone/releasescript.
// [S6020] Consider adding a CHANGELOG_OLD.md file to store older changelog entries. This file is supported by @alcalzone/releasescript.

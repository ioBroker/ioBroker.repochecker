'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   README file
    Numbering   :   6000 - 6999

*/

const execSync = require('node:child_process').execSync;

const common = require('./common.js');

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

async function checkReadme(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/README.md
    console.log('\n[E6000 - E6999] checkReadme');

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
        }

        let npmYear = 0;
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
            if (context.npmExists) {
                context.warnings.push('[W6010] Could not retrieve timestamp of LATEST revision at npm.');
            }
            common.error(`executing "npm view" - ${e}`);
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
                '[E6012] README.md contains instructions to install the adapter using direct npm commands. Adapters must not be installed using direct npm commands. Please remove these instructions.',
            );
        } else {
            context.checks.push('README.md does not contain direct npm install instructions');
        }

        // Check for iobroker url (github) install instructions
        if (/(?:^|\n)[^\n]*iobroker\s+url\s+https:\/\/github\.com\//i.test(data)) {
            context.errors.push(
                '[E6013] README.md contains instructions to install the adapter directly from GitHub using "iobroker url". Installation from GitHub is discouraged. Please remove these instructions.',
            );
        } else {
            context.checks.push('README.md does not contain GitHub URL install instructions');
        }

        // Check for ## Installation section
        if (/^##\s+Installation\s*$/im.test(data)) {
            context.warnings.push(
                '[S6014] README.md contains an "## Installation" section. Adapter installation is covered by standard ioBroker procedures. This section should be removed unless the adapter requires special installation handling.',
            );
        } else {
            context.checks.push('README.md does not contain an unnecessary Installation section');
        }

        //                    languages = languagedetect.detect(data, 3);
        //console.log(JSON.stringify(languages));
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

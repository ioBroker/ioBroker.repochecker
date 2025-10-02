'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   LICENSE file
    Numbering   :   7000 - 7999

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
    const yearRegex = /\d\d\d\d/g;
    let match;
    while ((match = yearRegex.exec(text)) !== null) {
        allYears.push(Number(match[0]));
    }
    return allYears.length > 0 ? Math.max(...allYears) : 0;
}

async function checkLicenseFile(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/LICENSE
    console.log('\n[E7000 - E7999] checkLicenseFile');

    let data;
    try {
        data = await common.getFile(context, '/LICENSE');
    } catch (e) {
        if (e.status == 404) {
            context.errors.push('[E7000] File LICENSE not found. Please add.');
        } else {
            context.errors.push(`[E7002] Cannot read LICENSE file. Please check. (Status ${e.status})`);
        }
    }
    if (data) {
        context.checks.push('LICENSE file found');

        let npmYear = 0;
        try {
            const result = execSync(`npm view iobroker.${context.adapterName} --json`, { encoding: 'utf-8' });
            const npmJson = JSON.parse(result);
            //console.log(`[DEBUG] ${JSON.stringify(npmJson)}`);
            if (npmJson['dist-tags'] && npmJson['dist-tags'].latest) {
                const latest = npmJson['dist-tags'].latest;
                const timeStr = npmJson.time[latest];
                npmYear = new Date(timeStr).getFullYear();
            }
        } catch (e) {
            console.log(`Error executing "npm view" - ${e}`);
        }

        if (context.packageJson.license === 'MIT') {
            const text = data;
            const year = new Date().getFullYear();
            const commitYear = context.lastCommitYear || 0;
            const licenseYear = getMaxYearFromText(text);

            common.info(
                `years detected: LICENSE ${licenseYear} / Current ${year} / Last commit ${commitYear} / NPM ${npmYear}`,
            );

            const valid = licenseYear === year || licenseYear >= commitYear || licenseYear >= npmYear;
            if (licenseYear > year) {
                const m = text.match(/(\d\d\d\d)-\d\d\d\d/);
                if (m) {
                    context.errors.push(
                        `[E7002] Future year (${licenseYear}) found in LICENSE. Please use "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE`,
                    );
                } else {
                    context.errors.push(
                        `[E7002]Future year (${licenseYear}) found in LICENSE. Please use "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE`,
                    );
                }
            } else if (!valid) {
                const m = text.match(/(\d\d\d\d)-\d\d\d\d/);
                if (m) {
                    context.errors.push(
                        `[E7001] No actual year found in LICENSE. Please add "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE`,
                    );
                } else {
                    context.errors.push(
                        `[E7001] No actual year found in LICENSE. Please add "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE`,
                    );
                }
            } else {
                context.checks.push(`Valid copyright year ${licenseYear} found in LICENSE`);
            }

            // Check for multiple copyright lines and trailing spaces
            const copyrightLines = data.split('\n').filter(line => line.trim().match(/^Copyright\s+\(c\)/i));
            if (copyrightLines.length > 1) {
                // Check all lines except the last one for trailing double spaces
                const linesWithoutTrailingSpaces = [];
                for (let i = 0; i < copyrightLines.length - 1; i++) {
                    if (!copyrightLines[i].match(/\s{2,}$/)) {
                        linesWithoutTrailingSpaces.push(i + 1);
                    }
                }
                if (linesWithoutTrailingSpaces.length > 0) {
                    context.warnings.push(
                        `[W7003] Multiple copyright lines found in LICENSE but line(s) ${linesWithoutTrailingSpaces.join(', ')} missing trailing spaces. Add two spaces at end of each copyright line (except last) for proper formatting.`,
                    );
                } else {
                    context.checks.push('Multiple copyright lines in LICENSE have proper trailing spaces');
                }
            }
        }
    }
    return context;
}

exports.checkLicenseFile = checkLicenseFile;

// List of error and warnings used at this module
// ----------------------------------------------

// [7000] File LICENSE not found. Please add.');
// [7001] No actual year found in LICENSE. Please add "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE
// [7001] No actual year found in LICENSE. Please add "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE
// [7002] Cannot read LICENSE file. Please check.');
// [7003] Multiple copyright lines found in LICENSE but line(s) ${linesWithoutTrailingSpaces.join(', ')} missing trailing spaces. Add two spaces at end of each copyright line (except last) for proper formatting.

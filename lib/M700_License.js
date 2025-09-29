'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   LICENSE file
    Numbering   :   700 - 799

*/

const execSync = require('node:child_process').execSync;

const common = require('./common.js');

function getAuthor(author) {
    if (author && typeof author === 'object') {
        return `${author.name} <${author.email}>`;
    }
    return author;
}

async function checkLicenseFile(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/LICENSE
    console.log('\n[E700 - E799] checkLicenseFile');

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
            let licenseYear = 0;
            let m = text.match(/\d\d\d\d\s*-\s*(\d\d\d\d)/);
            if (m) {
                licenseYear = Number(m[1]);
            }
            m = text.match(/(\d\d\d\d)/);
            if (m) {
                if (Number(m[1]) > licenseYear) {
                    licenseYear = Number(m[1]);
                }
            }

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

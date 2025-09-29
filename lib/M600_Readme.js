'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   README file
    Numbering   :   600 - 699

*/

const execSync = require('node:child_process').execSync;

const common = require('./common.js');

function getAuthor(author) {
    if (author && typeof author === 'object') {
        return `${author.name} <${author.email}>`;
    }
    return author;
}

async function checkReadme(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/README.md
    console.log('\n[E600 - E699] checkReadme');

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
                context.errors.push(
                    `[E6006] Current adapter version ${context.packageJson.version} not found in README.md`,
                );
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
            context.warnings.push('[W6006] Could not retrieve timestamp of LATEST revision at npm.');
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
            let readmeYear = 0;
            let m = text.match(/\d\d\d\d\s*-\s*(\d\d\d\d)/);
            if (m) {
                readmeYear = Number(m[1]);
            }
            m = text.match(/(\d\d\d\d)/); /* both variants could be present */
            if (m) {
                if (Number(m[1]) > readmeYear) {
                    readmeYear = Number(m[1]);
                }
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
// [6006] Could not retrieve timestamp of LATEST revision at npm.
// [6007] Future year (${readmeYear}) found in copyright. Please use "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the end of README.md

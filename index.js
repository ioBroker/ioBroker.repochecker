#!/usr/bin/env node
'use strict';
/*

   ___      _             _              _____ _               _
  / _ \    | |           | |            /  __ \ |             | |
 / /_\ \ __| | __ _ _ __ | |_ ___ _ __  | /  \/ |__   ___  ___| | _____ _ __
 |  _  |/ _` |/ _` | '_ \| __/ _ \ '__| | |   | '_ \ / _ \/ __| |/ / _ \ '__|
 | | | | (_| | (_| | |_) | ||  __/ |    | \__/\ | | |  __/ (__|   <  __/ |
 \_| |_/\__,_|\__,_| .__/ \__\___|_|     \____/_| |_|\___|\___|_|\_\___|_|
                   | |
                   |_|

 */
const axios = require('axios');

//const issues = require('./doc/issues');
const version = require('./package.json').version;

// include submodules
const common = require('./lib/common.js');
const config = require('./lib/config.js');
const M000_PackageJson = require('./lib/M000_PackageJson.js');
const M100_IOPackageJson = require('./lib/M100_IOPackageJson.js');
const M250_Npm = require('./lib/M250_Npm.js');
const M300_Testing = require('./lib/M300_Testing.js');
const M400_Repository = require('./lib/M400_Repository.js');
const M500_Code = require('./lib/M500_Code.js');
const M600_Readme = require('./lib/M600_Readme.js');
const M700_License = require('./lib/M700_License.js');
const M800_Github = require('./lib/M800_Github.js');
const M900_GitNpmIgnore = require('./lib/M900_GitNpmIgnore.js');

// disable axios caching
// axios.defaults.headers = {
//     'Cache-Control': 'no-cache',
//     Pragma: 'no-cache',
//     Expires: '0',
// };

// Error ranges
// E0xx
//      check package.json
//
// E100 - 249
//      check io-package.json
//
// E250 - 299
//      check npm and npmjs.org
//
// E3xx
//      check testing
//
// E4xx
//      check repositories
//
// E5xx
//      check code
//
// E6xx
//      check README file
//
// E7xx
//      check license file
//
// E8xx
//      check github repository
//
// E9xx
//      check .gitignore file

function getGithubApiData(context) {
    return new Promise((resolve, reject) => {
        common.debug('getGithubApiData');
        common.debug(`reading url '${context.githubUrlApi}'`);
        axios
            .get(context.githubUrlApi)
            .then(response => {
                context.githubApiData = response.data;
                // console.log(`API Data: ${JSON.stringify(context.githubApiData)}`);

                if (!context.branch) {
                    context.branch = context.githubApiData.default_branch; // main vs. master
                    common.debug(`Branch was not defined by user - checking branch: ${context.branch}`);
                }

                context.githubUrl = `${context.githubUrlOriginal.replace('https://github.com', 'https://raw.githubusercontent.com')}/${context.branch}`;
                common.debug(`Original URL: ${context.githubUrlOriginal}`);
                common.debug(`raw:          ${context.githubUrl}`);
                common.debug(`api:          ${context.githubUrlApi}`);

                resolve(context);
            })
            .catch(e => {
                context.errors.push(`[E000] FATAL: cannot access repository ${context.githubUrlApi}`);
                reject(e);
            }); // E0xx
    });
}

function makeResponse(code, data) {
    return {
        statusCode: code || 200,
        headers: {
            'Access-Control-Allow-Origin': '*', // Required for CORS support to work
            'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
        },
        body: typeof data === 'string' ? data : JSON.stringify(data),
    };
}

function check(request, ctx, callback) {
    //    console.log('PROCESS: ' + JSON.stringify(request));
    console.log('');

    if (!request.queryStringParameters.url) {
        return callback(null, makeResponse(500, { error: 'No github URL provided' }));
    }

    const context = {};
    context.checks = [];
    context.warnings = [];
    context.errors = [];

    let githubUrl = request.queryStringParameters.url;
    const githubBranch = request.queryStringParameters.branch;

    githubUrl = githubUrl
        .replace('http://', 'https://')
        .replace('https://www.github.com', 'https://github.com')
        .replace('https://raw.githubusercontent.com/', 'https://github.com/');

    if (githubUrl.match(/\/$/)) {
        githubUrl = githubUrl.substring(0, githubUrl.length - 1);
    }

    context.version = version;
    config.initConfig(context);
    context.checks.push(`Starting checker ioBroker.repochecker ${version}`);

    context.githubUrlOriginal = githubUrl;
    context.githubUrlApi = githubUrl.replace('https://github.com/', 'https://api.github.com/repos/');
    context.branch = githubBranch || null;
    context.repository = githubUrl.replace('https://github.com/', '');

    getGithubApiData(context)
        .then(context => M800_Github.getCommitInfos(context))
        .then(context => M000_PackageJson.getPackageJson(context))
        .then(context => M100_IOPackageJson.getIOPackageJson(context))
        .then(context => config.updateConfig(context))
        .then(context => config.logEnvironment(context))
        .then(context => M000_PackageJson.checkPackageJson(context))
        .then(context => M100_IOPackageJson.checkIOPackageJson(context))
        .then(context => M250_Npm.checkNpm(context))
        .then(context => M400_Repository.checkRepository(context))
        .then(context => M500_Code.checkCode(context))
        .then(context => M300_Testing.checkTests(context))
        .then(context => M800_Github.checkGithubRepo(context))
        .then(context => M600_Readme.checkReadme(context))
        .then(context => M700_License.checkLicenseFile(context))
        .then(context => M900_GitNpmIgnore.checkNpmIgnore(context))
        .then(context => M900_GitNpmIgnore.checkGitIgnore(context))
        .then(context => {
            return callback(
                null,
                makeResponse(200, {
                    result: 'OK',
                    checks: context.checks,
                    errors: context.errors,
                    warnings: context.warnings,
                    version,
                    hasTravis: context.hasTravis,
                    lastCommitSha: context.lastCommitSha,
                }),
            );
        })
        .catch(err => {
            console.error(`GLOBAL ERROR: ${err.toString()}, ${JSON.stringify(err)}`);
            context.errors.push(`[E999] GLOBAL ERROR: ${err.toString()}, ${JSON.stringify(err)}`);

            return callback(
                null,
                makeResponse(200, {
                    result: 'Errors found',
                    checks: context.checks,
                    errors: context.errors,
                    warnings: context.warnings,
                    version,
                    hasTravis: context.hasTravis,
                    lastCommitSha: context.lastCommitSha,
                    error: `${err.request ? err.request.path : ''} ${err.message}`,
                }),
            );
        });
}

// function getText(text, lang) {
//     if (typeof text === 'object') {
//         if (text[lang]) {
//             return text[lang];
//         }
//         return text.en;
//     }
//     return text;
// }

if (typeof module !== 'undefined' && module.parent) {
    exports.handler = check;
} else {
    let repoUrl = null;
    let repoBranch = null;

    // check options
    if (process.argv.includes('-d')) {
        process.argv.splice(process.argv.indexOf('-d'), 1);
        common.setDebug(true);
    }

    if (process.argv.includes('--debug')) {
        process.argv.splice(process.argv.indexOf('--debug'), 1);
        common.setDebug(true);
    }

    if (process.argv.includes('--noinfo')) {
        process.argv.splice(process.argv.indexOf('--noinfo'), 1);
        common.setInfo(common.isDebug() ? true : false);
    } else {
        common.setInfo(true);
    }

    if (process.argv.includes('--success')) {
        process.argv.splice(process.argv.indexOf('--success'), 1);
        common.setSuccess(true);
    }

    if (process.argv.includes('--local')) {
        process.argv.splice(process.argv.indexOf('--local'), 1);
        common.setLocal(true);
    }

    // Get url from parameters if possible
    if (process.argv.length > 2) {
        repoUrl = process.argv[2];

        if (!repoUrl.toLowerCase().includes('github.com')) {
            repoUrl = `https://github.com/${repoUrl}`;
        }
    } else {
        common.error('No repository specified');
        process.exit(1);
    }

    // Get branch from parameters if possible
    if (process.argv.length > 3) {
        repoBranch = process.argv[3];
    }

    common.info(`Checking repository ${repoUrl} (branch ${repoBranch})`);
    check(
        {
            queryStringParameters: {
                url: repoUrl,
                branch: repoBranch,
            },
        },
        null,
        (err, data) => {
            const context = JSON.parse(data.body);
            if (!common.isSuccess()) {
                common.info('');
                common.info('Summary of successful checks skipped, use --success to enable output');
            }

            console.log(`\nFINAL status '${context.result}'`);

            if (common.isSuccess()) {
                console.log('\n\n########## SUMMARY of successfull checks ##########\n');
                if (context.checks.length) {
                    context.checks.forEach(msg => {
                        console.log(msg);
                    });
                }
            }

            console.log('\n\n########## SUMMARY of ISSUES ##########');
            if (context.errors.length) {
                console.log('\n\nErrors:');
                context.errors.sort().forEach(err => {
                    // const issue = err.substring(1, 5);
                    console.error(err);
                    // if (issues[issue]) {
                    //     //if (issues[issue].title) {
                    //     //    console.error(getText(issues[issue].title, 'en'));
                    //     //}
                    //     if (issues[issue].explanation) {
                    //         console.error(getText(issues[issue].explanation, 'en'));
                    //     }
                    //     if (issues[issue].resolving) {
                    //         console.error(getText(issues[issue].resolving, 'en'));
                    //     }
                    //     if (issues[issue].notes) {
                    //         console.error(getText(issues[issue].notes, 'en'));
                    //     }
                    // }
                });
            } else {
                console.log('\n\nNO errors encountered.');
            }
            if (context.warnings.length) {
                console.log('\nWarnings:');
                context.warnings.sort().forEach(err => {
                    //const issue = err.substring(1, 5);
                    console.warn(err);
                    // if (issues[issue]) {
                    //     //if (issues[issue].title) {
                    //     //    console.warn(getText(issues[issue].title, 'en'));
                    //     //}
                    //     if (issues[issue].explanation) {
                    //         console.warn(getText(issues[issue].explanation, 'en'));
                    //     }
                    //     if (issues[issue].resolving) {
                    //         console.warn(getText(issues[issue].resolving, 'en'));
                    //     }
                    //     if (issues[issue].notes) {
                    //         console.warn(getText(issues[issue].notes, 'en'));
                    //     }
                    // }
                });
            } else {
                console.log('\n\nNO warnings encountered.');
            }
            console.log(`\ncreated by repochecker ${context.version} based on commit ${context.lastCommitSha}`);
        },
    );
}

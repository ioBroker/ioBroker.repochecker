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
//const issues = require('./doc/issues');
const fs = require('node:fs');
const dotenv = require('dotenv');
const version = require('./package.json').version;

// include submodules
const common = require('./lib/common.js');
const config = require('./lib/config.js');
const M0000_PackageJson = require('./lib/M0000_PackageJson.js');
const M1000_IOPackageJson = require('./lib/M1000_IOPackageJson.js');
const M2000_Npm = require('./lib/M2000_Npm.js');
const M3000_Testing = require('./lib/M3000_Testing.js');
const M4000_Repository = require('./lib/M4000_Repository.js');
const M5000_Code = require('./lib/M5000_Code.js');
const M6000_Readme = require('./lib/M6000_Readme.js');
const M7000_License = require('./lib/M7000_License.js');
const M8000_Github = require('./lib/M8000_Github.js');
const M9000_GitNpmIgnore = require('./lib/M9000_GitNpmIgnore.js');
const postprocessing = require('./lib/postprocessing.js');

// disable axios caching
// axios.defaults.headers = {
//     'Cache-Control': 'no-cache',
//     Pragma: 'no-cache',
//     Expires: '0',
// };

// Error ranges
// 0001 - 0999
//      check package.json
//
// 1000 - 1999
//      check io-package.json
//
// 2000 - 2999
//      check npm and npmjs.org
//
// 3000 - 3999
//      check testing
//
// 4000 - 4999
//      check repositories
//
// 5000 - 5999
//      check code
//
// 6000 - 6999
//      check README file
//
// 7000 - 7000
//      check license file
//
// 8000 - 8999
//      check github repository
//
// 9000 - 9998
//      check .gitignore file

function getGithubApiData(context) {
    return new Promise((resolve, reject) => {
        common.debug('getGithubApiData');
        common.debug(`reading url '${context.githubUrlApi}'`);
        context.axios
            .get(context.githubUrlApi)
            .then(response => {
                context.githubApiData = response.data;
                common.debug(`API Data: ${JSON.stringify(context.githubApiData)}`);

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
                context.errors.push(`[E0000] FATAL: cannot access repository ${context.githubUrlApi}`);
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
    const githubToken = request.queryStringParameters.githubToken;

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

    const githubTokenTrimmed = typeof githubToken === 'string' ? githubToken.trim() : '';
    if (githubTokenTrimmed) {
        context.githubToken = githubTokenTrimmed;
    }

    // initialize the axios instance (stored at context.axios) before any request is made
    common.initAxios(context);

    getGithubApiData(context)
        .then(context => M8000_Github.getCommitInfos(context))
        .then(context => M0000_PackageJson.getPackageJson(context))
        .then(context => M1000_IOPackageJson.getIOPackageJson(context))
        .then(context => M2000_Npm.getNpm(context))
        .then(context => M4000_Repository.getLatestRepo(context))
        .then(context => M5000_Code.getFilesList(context))
        .then(context => config.updateConfig(context))
        .then(context => config.logEnvironment(context))
        .then(context => M0000_PackageJson.checkPackageJson(context))
        .then(context => M1000_IOPackageJson.checkIOPackageJson(context))
        .then(context => M2000_Npm.checkNpm(context))
        .then(context => M4000_Repository.checkRepository(context))
        .then(context => M5000_Code.checkCode(context))
        .then(context => M0000_PackageJson.checkEslintFileChecks(context))
        .then(context => M0000_PackageJson.checkDependencyNodeRequirements(context))
        .then(context => M3000_Testing.checkTests(context))
        .then(context => M8000_Github.checkGithubRepo(context))
        .then(context => M6000_Readme.checkReadme(context))
        .then(context => M7000_License.checkLicenseFile(context))
        .then(context => M9000_GitNpmIgnore.checkNpmIgnore(context))
        .then(context => M9000_GitNpmIgnore.checkGitIgnore(context))
        .then(context => postprocessing.postprocessing(context))
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
            const sanitizedErrorJson = common.stringifyError(err);
            console.error(`GLOBAL ERROR: ${err.toString()}, ${sanitizedErrorJson}`);
            context.errors.push(`[E9999] GLOBAL ERROR: ${err.toString()}, ${sanitizedErrorJson}`);

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

// Read and validate the GITHUB_TOKEN from an environment file passed via --env.
// The file is only parsed - it is NEVER loaded into process.env. Only the
// GITHUB_TOKEN variable is extracted, all other content is ignored.
// Returns the trimmed token string, or null if no usable token could be retrieved.
function getGithubTokenFromEnvFile(envFile) {
    // The value passed to --env must name an existing file.
    if (!fs.existsSync(envFile) || !fs.statSync(envFile).isFile()) {
        common.error(`--env: file "${envFile}" does not exist`);
        process.exit(1);
    }

    // Parse the file using dotenv WITHOUT loading it into the environment.
    let parsed;
    try {
        const content = fs.readFileSync(envFile);
        parsed = dotenv.parse(content);
    } catch (e) {
        common.error(`--env: file "${envFile}" could not be parsed as an environment file: ${e.message}`);
        process.exit(1);
    }

    // Extract only GITHUB_TOKEN, ignore everything else.
    if (!Object.prototype.hasOwnProperty.call(parsed, 'GITHUB_TOKEN')) {
        common.warn(`--env: GITHUB_TOKEN has not been detected in "${envFile}", continuing as if no --env had been specified`);
        return null;
    }

    const token = (parsed.GITHUB_TOKEN || '').trim();
    if (!token) {
        common.warn(`--env: GITHUB_TOKEN is empty, continuing as if no --env had been specified`);
        return null;
    }

    // Verify the token against the known GitHub personal access token formats.
    // Classic tokens:      "ghp_" prefix, 40 characters total.
    // Fine-grained tokens: "github_pat_" prefix, 93 characters total.
    // See https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
    const isClassic = token.startsWith('ghp_') && token.length === 40;
    const isFineGrained = token.startsWith('github_pat_') && token.length === 93;
    if (!isClassic && !isFineGrained) {
        common.warn(`--env: GITHUB_TOKEN does not match the expected GitHub personal access token format, continuing with this token anyway`);
    }

    return token;
}

if (typeof module !== 'undefined' && module.parent) {
    exports.handler = check;
} else {
    let repoUrl = null;
    let repoBranch = null;
    let githubToken = null;

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

    if (process.argv.includes('--strict')) {
        process.argv.splice(process.argv.indexOf('--strict'), 1);
        common.setStrict(true);
    }

    // --env <file> or --env=<file>: read a GITHUB_TOKEN from an environment file (see getGithubTokenFromEnvFile)
    const envIdx = process.argv.findIndex(arg => arg === '--env' || arg.startsWith('--env='));
    if (envIdx !== -1) {
        let envFile;
        if (process.argv[envIdx].startsWith('--env=')) {
            // --env=<file>: value is part of the same argument
            envFile = process.argv[envIdx].slice('--env='.length);
            process.argv.splice(envIdx, 1);
        } else {
            // --env <file>: value is the next argument
            envFile = process.argv[envIdx + 1];
            if (!envFile || envFile.startsWith('-')) {
                common.error('--env: no file specified');
                process.exit(1);
            }
            // remove both '--env' and its value from argv before positional parsing
            process.argv.splice(envIdx, 2);
        }
        if (!envFile) {
            common.error('--env: no file specified');
            process.exit(1);
        }
        githubToken = getGithubTokenFromEnvFile(envFile);
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
                githubToken: githubToken,
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
            if (context.warnings.filter(txt => txt.startsWith('[W')).length) {
                console.log('\nWarnings:');
                context.warnings
                    .filter(txt => txt.startsWith('[W'))
                    .sort()
                    .forEach(err => {
                        console.warn(err);
                    });
            } else {
                console.log('\n\nNO warnings encountered.');
            }
            if (context.warnings.filter(txt => txt.startsWith('[S')).length) {
                console.log('\nSuggestionss:');
                context.warnings
                    .filter(txt => txt.startsWith('[S'))
                    .sort()
                    .forEach(err => {
                        console.warn(err);
                    });
            } else {
                console.log('\n\nNO suggestions encountered.');
            }
            console.log(`\ncreated by repochecker ${context.version} based on commit ${context.lastCommitSha}`);

            if (common.isLocal()) {
                console.log(`\n----------------------------------------------------------`);
                console.log(`This check has been run using --local mode.`);
                console.log(`Please note that local mode is experimental state only and`);
                console.log(`may report false positive findings and miss real issues.`);
                console.log(`----------------------------------------------------------`);
            }

            if (common.isLocal() && context.errors.length) {
                process.exit(1);
            }
        },
    );
}

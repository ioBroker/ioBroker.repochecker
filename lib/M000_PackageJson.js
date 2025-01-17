'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   package.json
    Numbering   :   001 - 099

*/

const compareVersions = require('compare-versions');

const common = require('./common.js');

// Note: node version specify rules for engines clase and do NOT reflect the recommended node version for users
const recommendedNodeVersion = '18'; // This is the minimum node version that should be required at engines clause
const requiredNodeVersion = '18'; // This is the minimum node version that must be required at engines clause

/* TODO: configuration should be moved to context */

const dependenciesPackageJson = {
    '@iobroker/adapter-core': {
        required: '3.1.4',
        recommended: '3.2.3',
    },
};

const devDependenciesPackageJson = {
    '@iobroker/testing': {
        required: '4.1.3',
        recommended: '5.0.0',
        onlyWWW: false,
    },
};

const blacklistedDependenciesPackageJson = {
    npm: {
        msg: "'npm'must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    'iobroker.js-controller': {
        msg: "'iobroker.js-controller' must not be listed as dependency at package.json.Please remove and create new release.",
        err: true,
    },
    '@iobroker/adapter-dev': {
        msg: "'@iobroker/adapter-dev' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@iobroker/dev-server': {
        msg: "'@iobroker/dev-server' must not be listed as dependency at package.json. Please remove.",
        err: true,
    },
    '@iobroker/plugin-sentry': {
        msg: "'@iobroker/plugin-sentry' must not be listed as dependency at package.json as it will crash js-controller 7 systems. Please remove and create new release.",
        err: true,
    },
    '@iobroker/repochecker': {
        msg: "'@iobroker/repochecker' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@alcalzone/release-script': {
        msg: "'@alcalzone/release-script' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-iobroker': {
        msg: "'@alcalzone/release-script-plugin-iobroker' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-license': {
        msg: "'@alcalzone/release-script-plugin-license' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-package': {
        msg: "'@alcalzone/release-script-plugin-package' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-manual-review': {
        msg: "'@alcalzone/release-script-plugin-manual-review' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-version': {
        msg: "'@alcalzone/release-script-plugin-version' must not be listed as dependency at package.json. Please remove and create new release.",
        err: true,
    },
};

const blacklistedDevDependenciesPackageJson = {
    npm: {
        msg: "'npm'must not be listed as devDependency at package.json. Please remove.",
        err: true,
    },
    'iobroker.js-controller': {
        msg: "'iobroker.js-controller' must not be listed as devDependency at package.json. Please remove.",
        err: true,
    },
    '@iobroker/plugin-sentry': {
        msg: "'@iobroker/plugin-sentry' must not be listed as devDependency at package.json. Please remove.",
        err: true,
    },
};

const blacklistPackageJson = {};

async function getPackageJson(context) {
    common.debug('\ngetPackageJson');

    const packageJson = await common.downloadFile(context.githubUrl, '/package.json');
    context.packageJson = packageJson;
    if (typeof context.packageJson === 'string') {
        try {
            context.packageJson = JSON.parse(context.packageJson);
        } catch (e) {
            context.errors.push(`[E001] Cannot parse package.json: ${e}`);
        }
    }
    return context;
}

async function checkPackageJson(context) {
    common.log('[E001 - E099] checkPackageJson');

    if (!context.githubUrlOriginal.match(/\/iobroker\./i)) {
        context.errors.push('[E002] No "ioBroker." found in the name of repository');
    } else {
        context.checks.push('"ioBroker" was found in the name of repository');
    }

    if (context.githubUrlOriginal.includes('/iobroker.')) {
        context.errors.push(
            '[E003] Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase',
        );
    } else {
        context.checks.push('Repository has name ioBroker.adaptername (not iobroker.adaptername)');
    }

    const m = context.githubUrlOriginal.match(/\/ioBroker\.(.*)$/);
    let adapterName = '';
    if (!m || !m[1]) {
        context.errors.push(`[E004] No adapter name found in URL: ${context.githubUrlOriginal}`);
    } else {
        context.checks.push('Adapter name found in the URL');
        adapterName = m[1].replace(/\/master$/, '').replace(/\/main$/, '');
    }

    context.adapterName = adapterName;

    if (adapterName.match(/[A-Z]/)) {
        context.errors.push('[E005] Adapter name must be lowercase');
    } else {
        context.checks.push('Adapter name is lowercase');
    }

    if (adapterName.match(/[^-_a-z\d]/)) {
        context.errors.push(
            `[E006] Invalid characters found in adapter name "${adapterName}". Only lowercase chars, digits, "-" and "_" are allowed`,
        );
    } else {
        context.checks.push(`No invalid characters found in "${adapterName}"`);
    }

    if (adapterName.startsWith('_')) {
        context.errors.push(`[E024] Adapter name "${adapterName}" may not start with '_'`);
    } else {
        context.checks.push(`Adapter name "${adapterName}" does not start with '_'`);
    }

    const n = context.githubUrlOriginal.match(/\/([^/]+)\/iobroker\./i);
    if (!n || !n[1]) {
        context.errors.push('[E007] Cannot find author repo in the URL');
    } else {
        context.authorName = n[1];
    }

    if (context.packageJson.name !== `iobroker.${adapterName.toLowerCase()}`) {
        context.errors.push(
            `[E020] Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}". Now is "${context.packageJson.name}"`,
        );
    } else {
        context.checks.push(
            `Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}".`,
        );
    }

    if (!context.packageJson.version) {
        context.errors.push('[E009] No version found in the package.json');
    } else {
        context.checks.push('Version found in package.json');
    }

    if (!context.packageJson.description) {
        context.errors.push('[E010] No description found in the package.json');
    } else {
        context.checks.push('Description found in package.json');
    }

    if (context.packageJson.licenses) {
        context.errors.push(
            '[E021] "licenses" in package.json are deprecated. Please remove and use "license": "NAME" field.',
        );
    } else {
        context.checks.push('No "licenses" found in package.json');
    }

    if (!context.packageJson.author) {
        context.errors.push('[E013] No author found in the package.json');
    } else {
        context.checks.push('Author found in package.json');
    }

    if (context.packageJson._args) {
        context.errors.push(
            '[E014] NPM information found in package.json. Please remove all attributes starting with "_"',
        );
    } else {
        context.checks.push('No npm generated attributes found in package.json');
    }

    if (!context.packageJson.license) {
        context.errors.push('[E015] No license found in package.json');
    } else {
        context.checks.push('"license" found in package.json');

        // check if license valid
        if (!context.cfg.allowedLicenses.includes(context.packageJson.license)) {
            context.errors.push(
                `[E016] ${context.packageJson.license} found in package.json is no valid SPDX license. Please use one of listed here: https://spdx.org/licenses/`,
            );
        } else {
            context.checks.push('"license" is valid in package.json');
        }
    }

    if (!context.packageJson.repository) {
        context.errors.push('[E017] No repository found in the package.json');
    } else {
        context.checks.push('Repository found in package.json');

        const allowedRepoUrls = [
            context.githubApiData.html_url, // https://github.com/klein0r/ioBroker.luftdaten
            `git+${context.githubApiData.html_url}`, // git+https://github.com/klein0r/ioBroker.luftdaten
            context.githubApiData.git_url, // git://github.com/klein0r/ioBroker.luftdaten.git
            context.githubApiData.ssh_url, // git@github.com:klein0r/ioBroker.luftdaten.git
            context.githubApiData.clone_url, // https://github.com/klein0r/ioBroker.luftdaten.git
            `git+${context.githubApiData.clone_url}`, // git+https://github.com/klein0r/ioBroker.luftdaten.git
        ];

        // https://docs.npmjs.com/cli/v7/configuring-npm/package-json#repository
        if (context.packageJson.repository && typeof context.packageJson.repository === 'object') {
            if (context.packageJson.repository.type !== 'git') {
                context.errors.push(
                    `[E018] Invalid repository type in package.json: ${context.packageJson.repository.type}. It should be git`,
                );
            } else {
                context.checks.push('Repository type is valid in package.json: git');
            }

            if (!allowedRepoUrls.includes(context.packageJson.repository.url)) {
                context.errors.push(
                    `[E019] Invalid repository URL in package.json: ${context.packageJson.repository.url}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}`,
                );
            } else {
                context.checks.push('Repository URL is valid in package.json');
            }
        } else if (context.packageJson.repository && typeof context.packageJson.repository === 'string') {
            if (!allowedRepoUrls.includes(context.packageJson.repository)) {
                context.errors.push(
                    `[E019] Invalid repository URL in package.json: ${context.packageJson.repository}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}`,
                );
            } else {
                context.checks.push('Repository URL is valid in package.json');
            }
        } else {
            context.errors.push('[E012] Invalid repository object in package.json');
        }
    }

    if (context.cfg.reservedAdapterNames.includes(adapterName)) {
        context.errors.push('[E022] Adapter name is reserved. Please rename adapter.');
    } else {
        context.checks.push('Adapter name is not reserved');
    }

    if (!context.ioPackageJson.common.onlyWWW && !context.packageJson.dependencies) {
        context.errors.push('[W030] No dependencies declared at package.json. Is this really correct?');
    }
    if (!context.packageJson.devDependencies) {
        context.errors.push('[E031] No devDependencies declared at package.json. Please correct package.json');
    }

    if (context.packageJson.dependencies) {
        for (const blacklist in blacklistedDependenciesPackageJson) {
            if (context.packageJson.dependencies[blacklist]) {
                if (blacklistedDependenciesPackageJson[blacklist].err) {
                    context.errors.push(`[E050] ${blacklistedDependenciesPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W051] ${blacklistedDependenciesPackageJson[blacklist].msg}`);
                }
            }
        }
    }

    if (context.packageJson.devDependencies) {
        for (const blacklist in blacklistedDevDependenciesPackageJson) {
            if (context.packageJson.devDependencies[blacklist]) {
                if (blacklistedDevDependenciesPackageJson[blacklist].err) {
                    context.errors.push(`[E052] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W053] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`);
                }
            }
        }
    }

    // if ((context.packageJson.dependencies && context.packageJson.dependencies.npm) || (context.packageJson.optionalDependencies && context.packageJson.optionalDependencies.npm)) {
    //     context.errors.push('[E023] Do not include "npm" as dependency!');
    // } else {
    //     context.checks.push('npm is not in dependencies');
    // }

    // if ((context.packageJson.dependencies && context.packageJson.dependencies['iobroker.js-controller']) ||
    // (context.packageJson.devDependencies && context.packageJson.devDependencies['iobroker.js-controller']) ||
    // (context.packageJson.optionalDependencies && context.packageJson.optionalDependencies['iobroker.js-controller'])
    // ) {
    //     context.errors.push('[E025] "iobroker.js-controller" must not be listed as dependency at package.json');
    // } else {
    //     context.checks.push('iobroker.js-controller is not in dependencies');
    // }

    // if ((context.packageJson.dependencies && context.packageJson.dependencies['@iobroker/dev-server']) ||
    // (context.packageJson.optionalDependencies && context.packageJson.optionalDependencies['@iobroker/dev-server'])
    // ) {
    //     context.errors.push('[E011] "@iobroker/dev-server" must not be listed as dependency at package.json');
    // } else {
    //     context.checks.push('iobroker.@iobroker/dev-server is not in dependencies');
    // }

    if (!context.ioPackageJson.common.onlyWWW) {
        if (!context.packageJson.engines) {
            context.errors.push(
                `[E026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended`,
            );
        } else {
            if (!context.packageJson.engines.node) {
                context.errors.push(
                    `[E026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended`,
                );
            } else {
                context.checks.push('engines attribute containing node requirements exist.');
                // 'engines': { 'node': '>= 18' }
                // 'engines': { 'node': '>= 18.1.2' }
                // 'engines': { 'node': '>= 18.1.2 < 19' }
                const nodeVal = context.packageJson.engines.node;
                const match = nodeVal.match(/^(?<cmp>[<>=~]+)?\s*(?<vers>\d+(\.\d+(\.\d+)?)?(-\w+\.\d+)?)/m);
                if (!match) {
                    context.warnings.push(
                        `[W027] Engines clause at at package.json ({'engines' : { 'node' : '${nodeVal}' } }") is not parseable.`,
                    );
                } else {
                    common.debug(`node check: ${JSON.stringify(match.groups)}`);
                    if (match.groups.cmp !== '>' && match.groups.cmp !== '>=') {
                        context.warnings.push(
                            `[W028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.`,
                        );
                    } else {
                        if (!compareVersions.compare(match.groups.vers, requiredNodeVersion, '>=')) {
                            context.errors.push(
                                `[E029] Node.js ${requiredNodeVersion} is required as minimum, node.js ${recommendedNodeVersion} is recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.`,
                            );
                        } else if (!compareVersions.compare(match.groups.vers, recommendedNodeVersion, '>=')) {
                            context.warnings.push(
                                `[W028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.`,
                            );
                        } else {
                            context.checks.push(
                                `Correct node.js version ${match.groups.vers} requested by "engines" attribute at package.json.`,
                            );
                        }
                    }
                }
            }
        }
    } else {
        context.checks.push('"engines" check skipped for wwwOnly adapter.');
    }

    if (!context.ioPackageJson.common.onlyWWW) {
        for (const dependency in dependenciesPackageJson) {
            const requiredVersion = dependenciesPackageJson[dependency].required;
            const recommendedVersion = dependenciesPackageJson[dependency].recommended;
            let dependencyVersion = context.packageJson.dependencies[`${dependency}`] || '';
            dependencyVersion = dependencyVersion.replace(/[\^~]/, '');
            if (!dependencyVersion) {
                context.errors.push(
                    `[E032] No dependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to dependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, requiredVersion, '>=')) {
                context.errors.push(
                    `[E033] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum, ${recommendedVersion} is recommended. Please update dependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, recommendedVersion, '>=')) {
                context.warnings.push(
                    `[W034] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating dependencies at package.json`,
                );
            } else {
                context.checks.push('dependency ${dependency} ${dependencyVersion} is ok');
            }
        }
        context.checks.push('"dependenciesPackageJson" checked.');
    } else {
        context.checks.push('"dependenciesPackageJson" check skipped for wwwOnly adapter.');
    }

    for (const dependency in devDependenciesPackageJson) {
        if (devDependenciesPackageJson[dependency].onlyWWW === false && context.ioPackageJson.common.onlyWWW) {
            continue;
        }
        const requiredVersion = devDependenciesPackageJson[dependency].required;
        const recommendedVersion = devDependenciesPackageJson[dependency].recommended;
        let dependencyVersion = context.packageJson.devDependencies[`${dependency}`] || '';
        dependencyVersion = dependencyVersion.replace(/[\^~]/, '');
        if (!dependencyVersion) {
            context.errors.push(
                `[E035] No devDependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to devDependencies at package.json`,
            );
        } else if (!compareVersions.compare(dependencyVersion, requiredVersion, '>=')) {
            context.errors.push(
                `[E036] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum,  ${recommendedVersion} is recommended. Please update devDependencies at package.json`,
            );
        } else if (!compareVersions.compare(dependencyVersion, recommendedVersion, '>=')) {
            context.warnings.push(
                `[W037] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating devDependencies at package.json`,
            );
        } else {
            context.checks.push('devDependency ${dependency} ${dependencyVersion} is ok');
        }
    }
    context.checks.push('"devDependenciesPackageJson" checked.');

    const enforcedDependencies = [
        '@iobroker/adapter-core',
        '@alcalzone/release-script',
        '@alcalzone/release-script-plugin-iobroker',
        '@alcalzone/release-script-plugin-license',
        '@alcalzone/release-script-manual-review',
        '@iobroker/adapter-dev',
        '@iobroker/testing',
    ];
    for (const dependency in context.packageJson.dependencies) {
        if (
            !context.packageJson.dependencies[dependency].startsWith('^') &&
            !context.packageJson.dependencies[dependency].startsWith('~') &&
            !context.packageJson.dependencies[dependency].startsWith('>')
        ) {
            if (context.packageJson.dependencies[dependency].toLowerCase().includes('github.com')) {
                context.warnings.push(
                    `[W043] dependency should not require a github version. Please change "${dependency}:${context.packageJson.dependencies[dependency]}"`,
                );
            } else if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E044] dependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"`,
                );
            } else {
                context.warnings.push(
                    `[W047] dependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"`,
                );
            }
        }
    }

    for (const dependency in context.packageJson.devDependencies) {
        if (
            !context.packageJson.devDependencies[dependency].startsWith('^') &&
            !context.packageJson.devDependencies[dependency].startsWith('~') &&
            !context.packageJson.devDependencies[dependency].startsWith('>')
        ) {
            if (context.packageJson.devDependencies[dependency].toLowerCase().includes('github.com')) {
                context.warnings.push(
                    `[W045] devDependency should not require github versions. Please change "${dependency}:${context.packageJson.devDependencies[dependency]}"`,
                );
            } else if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E046] devDependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"`,
                );
            } else {
                context.warnings.push(
                    `[W048] devDependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"`,
                );
            }
        }
    }

    for (const blacklist in blacklistPackageJson) {
        // common.log(`checking blacklist ${blacklist}`);
        let tmp = context.packageJson;
        let log = '';
        for (const element of blacklist.split('.')) {
            log = `${log}.${element}`;
            //common.log(`   check ${log}`);
            tmp = tmp[element];
            if (!tmp) {
                //common.log(`   ${log} does not exist`);
                break;
            }
        }
        if (tmp) {
            if (blacklistPackageJson[blacklist].err) {
                context.errors.push(`[E038] ${blacklistPackageJson[blacklist].msg}`);
            } else {
                context.warnings.push(`[W038] ${blacklistPackageJson[blacklist].msg}`);
            }
        }
        // else {
        //    common.log(`blacklist ${blacklist} no match`);
        // }
    }
    context.checks.push('"blacklist (package)" checked.');

    if (!context.packageJson.keywords || !Array.isArray(context.packageJson.keywords)) {
        context.errors.push('[E039] "keywords" must be an array within package.json and contain some useful keywords');
    } else {
        const forbiddenKeywords = [];
        const ignoredKeywords = ['iobroker', 'smart home', 'smarthome', 'home automation', 'template'];
        const recommendedKeywords = ['ioBroker'];
        common.debug(`package.keywords: "${context.packageJson.keywords.join(', ')}"`);
        common.debug(
            `filtered: "${context.packageJson.keywords.filter(keyword => !ignoredKeywords.includes(keyword.toLowerCase()))}"`,
        );
        if (
            context.packageJson.keywords.filter(keyword => !ignoredKeywords.includes(keyword.toLowerCase())).length ===
            0
        ) {
            context.errors.push(
                `[E049] "keywords" within package.json must contain some keywords besides "${context.packageJson.keywords.join(', ')}" related to adapter`,
            );
        }
        if (!recommendedKeywords.filter(keyword => context.packageJson.keywords.includes(keyword)).length > 0) {
            context.warnings.push(
                `[W040] "keywords" within package.json should contain "${recommendedKeywords.join(', ')}"`,
            );
        }
        if (
            forbiddenKeywords.filter(keyword =>
                context.packageJson.keywords.map(k => k.toLowerCase()).includes(keyword),
            ).length > 0
        ) {
            context.warnings.push(
                `[W041] "keywords" within package.json should not contain "${forbiddenKeywords.join(', ')}"`,
            );
        }

        context.checks.push('"keywords" found in package.json and refers to an array');
    }

    if (context.packageJson.globalDependencies) {
        context.errors.push(
            '[E042] "globalDependencies" is misplaced at package.json. Did you mean "common.globalDependencies" at io-package.json?',
        );
    } else {
        context.checks.push('"globalDependencies" not found in package.json');
    }

    // single free 008
    // first free 054

    return context;
}

exports.getPackageJson = getPackageJson;
exports.checkPackageJson = checkPackageJson;

// List of error and warnings used at this module
// ----------------------------------------------

// [001] Cannot parse package.json: ${e}
// [002] No "ioBroker." found in the name of repository
// [003] Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase
// [004] No adapter name found in URL: ${context.githubUrlOriginal}
// [005] Adapter name must be lowercase
// [006] Invalid characters found in adapter name "${adapterName}". Only lowercase chars, digits, "-" and "_" are allowed
// [007] Cannot find author repo in the URL
// [008] - free -
// [009] No version found in the package.json
// [010] No description found in the package.json
// [011] ### "@iobroker/dev-server" must not be listed as dependency at package.json'
// [012] Invalid repository object in package.json
// [013] No author found in the package.json
// [014] NPM information found in package.json. Please remove all attributes starting with "_"
// [015] No license found in package.json
// [016] ${context.packageJson.license} found in package.json is no valid SPDX license. Please use one of listed here: https://spdx.org/licenses/
// [017] No repository found in the package.json
// [018] Invalid repository type in package.json: ${context.packageJson.repository.type}. It should be git
// [019] Invalid repository URL in package.json: ${context.packageJson.repository.url}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}
// [019] Invalid repository URL in package.json: ${context.packageJson.repository}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}
// [020] Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}". Now is "${packageJson.name}"
// [021] "licenses" in package.json are deprecated. Please remove and use "license": "NAME" field.
// [022] Adapter name is reserved. Please rename adapter.
// [023] ### Do not include "npm" as dependency!
// [024] Adapter name "${adapterName}" may not start with '_'y!
// [025] ### "iobroker.js-controller" must not be listed as dependency at package.json'
// [026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended
// [026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended
// [027] Engines clause at at package.json ({'engines' : { 'node' : '${nodeVal}' } }") is not parseable.
// [028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.
// [028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.
// [029] Node.js ${requiredNodeVersion} is required as minimum, node.js ${recommendedNodeVersion} is recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.
// [030] No dependencies declared at package.json. Is this really correct?
// [031] No devDependencies declared at package.json. Please correct package.json
// [032] No dependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to dependencies at package.json
// [033] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum, ${recommendedVersion} is recommended. Please update dependencies at package.json
// [034] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating dependencies at package.json
// [035] No devDependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to devDependencies at package.json
// [036] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum,  ${recommendedVersion} is recommended. Please update devDependencies at package.json
// [037] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating devDependencies at package.json
// [038] ${blacklistPackageJson[blacklist].msg}
// [038] ${blacklistPackageJson[blacklist].msg}
// [039] "keywords" must be an array within package.json and contain some useful keywords
// [040] "keywords" within package.json should contain "${recommendedKeywords.join(', ')}"
// [041] "keywords" within package.json should not contain "${forbiddenKeywords.join(', ')}"
// [042] "globalDependencies" is misplaced at package.json. Did you mean "common.globalDependencies" at io-package.json?
// [043] dependency should not require a github version. Please change "${dependency}:${context.packageJson.dependencies[dependency]}"
// [044] dependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"
// [045] devDependency should not require github versions. Please change "${dependency}:${context.packageJson.devDependencies[dependency]}"
// [046] devDependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"
// [047] dependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"
// [048] devDependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"
// [049] "keywords" within package.json must contain some keywords besides "${context.packageJson.keywords.join(', ')}" related to adapter
// [E050] ${blacklistedDependenciesPackageJson[blacklist].msg}
// [W051] ${blacklistedDependenciesPackageJson[blacklist].msg}.
// [E052] ${blacklistedDevDependenciesPackageJson[blacklist].msg}
// [W053] ${blacklistedDevDependenciesPackageJson[blacklist].msg}

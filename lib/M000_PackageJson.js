'use strict';

/*
    This module is a support module for iobroker.repochecker

    Area checked:   package.json
    Numbering   :   001 - 099

*/

const compareVersions = require('compare-versions');

const common = require('./common.js');

/* TODO: configuration should be moved to context */

// node.js versions required and recommended
// Note: node version specify rules for engines clause and do NOT reflect the recommended node version for users
const recommendedNodeVersion = '20'; // This is the minimum node version that should be required at engines clause
const requiredNodeVersion = '18'; // This is the minimum node version that must be required at engines clause

// packages which must or should be required as dependencies
const dependenciesPackageJson = {
    '@iobroker/adapter-core': {
        required: '3.2.3',
        recommended: '3.3.2',
        onlyWWW: false,
    },
};

// packages which must or should be required as devDependencies
const devDependenciesPackageJson = {
    '@alcalzone/release-script': {
        required: '3.8.0',
        recommended: '3.8.0',
        optional: true,
        suggested: true,
    },
    '@iobroker/adapter-dev': {
        required: '1.3.0',
        recommended: '1.4.0',
        onlyWWW: false,
        optional: true,
        suggested: true,
    },
    '@iobroker/eslint-config': {
        required: '2.0.0',
        recommended: '2.1.0',
        onlyWWW: false,
        optional: true,
        suggested: true,
    },
    '@iobroker/legacy-testing': {
        required: '2.0.2',
        recommended: '2.0.2',
        onlyWWW: false,
        optional: true,
    },
    '@iobroker/testing': {
        required: '4.1.3',
        recommended: '5.1.0',
        onlyWWW: false,
        alternatives: ['@iobroker/legacy-testing'],
    },
};

// packages which must NOT be listed as dependencies in any context
const blacklistedAllDependenciesPackageJson = {
    npm: {
        msg: "'npm'must not be listed as any dependency at package.json. Please remove and create new release.",
        err: true,
    },
    'iobroker.js-controller': {
        msg: "'iobroker.js-controller' must not be listed as any dependency at package.json. Please remove and create new release.",
        err: true,
    },
    '@iobroker/plugin-sentry': {
        msg: "'@iobroker/plugin-sentry' must not be listed as any dependency at package.json as it will crash js-controller 7 systems. Please remove and create new release.",
        err: true,
    },
    '@iobroker/repochecker': {
        msg: "'@iobroker/repochecker' must not be listed as any dependency at package.json. Please remove and create new release.",
        err: true,
    },
    request: {
        msg: "'request' package is deprecated and no longer maintained. Please consider migrating to package 'axios'.",
        err: false,
    },
};

// packages which must NOT be listed as dependencies
const blacklistedDependenciesPackageJson = {
    ...blacklistedAllDependenciesPackageJson,

    '@iobroker/adapter-core': {
        msg: "'@iobroker/adapter-core' seems to be obsolete as dependency at package.json as 'common.onlyWWW' is set to true.",
        err: false,
        onlyWWW: true,
    },

    '@iobroker/adapter-dev': {
        msg: "'@iobroker/adapter-dev' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@iobroker/dev-server': {
        msg: "'@iobroker/dev-server' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@iobroker/eslint-config': {
        msg: "'@iobroker/eslint-config' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@iobroker/testing': {
        msg: "'@iobroker/testing' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@alcalzone/release-script': {
        msg: "'@alcalzone/release-script' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-iobroker': {
        msg: "'@alcalzone/release-script-plugin-iobroker' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-license': {
        msg: "'@alcalzone/release-script-plugin-license' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-package': {
        msg: "'@alcalzone/release-script-plugin-package' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-manual-review': {
        msg: "'@alcalzone/release-script-plugin-manual-review' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@alcalzone/release-script-plugin-version': {
        msg: "'@alcalzone/release-script-plugin-version' must not be listed as dependency at package.json. Please move to devDependencies and create a new release.",
        err: true,
    },
    '@types/.*': {
        msg: "Dependency '${dependency}' should most likely be listed as devDependency. Please check.",
        err: false,
    },
};

// packages which must NOT be listed as devDependencies
const blacklistedDevDependenciesPackageJson = {
    ...blacklistedAllDependenciesPackageJson,

    '@iobroker/adapter-core': {
        msg: "'@iobroker/adapter-core' must not be listed as devDependency at package.json. Please move to dependencies and create a new release.",
        err: true,
    },
    axios: {
        msg: "Package 'axios' listed as devDependency at package.json might be obsolete if using '@iobroker/adapter-dev'.",
        err: false,
    },
};

// packages which must NOT be listed as peerDependencies
const blacklistedPeerDependenciesPackageJson = {
    ...blacklistedAllDependenciesPackageJson,
    ...blacklistedDependenciesPackageJson,

    '@iobroker/adapter-core': {
        msg: "'@iobroker/adapter-core' must not be listed as peerDependency at package.json. Please move to dependencies and create a new release.",
        err: true,
    },
};

// packages which must NOT be listed as optionalDependencies
const blacklistedOptionalDependenciesPackageJson = {
    ...blacklistedAllDependenciesPackageJson,
    ...blacklistedDependenciesPackageJson,

    '@iobroker/adapter-core': {
        msg: "'@iobroker/adapter-core' must not be listed as optionalDependency at package.json. Please move to dependencies and create a new release.",
        err: true,
    },
};

const blacklistPackageJson = {
    licenses: {
        msg: 'Attribute "licenses" in package.json is deprecated. Please remove and use "license": "NAME" attribute.',
        err: true,
    },
};

const validObjectsPackageJson = [
    'author',
    'bin',
    // 'browser',
    'bugs',
    'bundleDependencies',
    // 'config',
    'contributors',
    'cpu',
    'dependencies',
    'description',
    'devDependencies',
    'devEngines',
    'directories',
    'directories.bin',
    'directories.man',
    'engines',
    // 'exports',
    'files',
    'funding',
    'homepage',
    'keywords',
    'libc',
    'license',
    'licenses', // deprecated
    'main',
    'man',
    'maintainers', // invalid - will raise a warning to use contributors
    'name',
    'nyc', // inofficial - extension for nyc package
    'optionalDependencies',
    'os',
    'overrides',
    'peerDependencies',
    'peerDependenciesMeta',
    // 'private',
    'publishConfig',
    'readmeFilename', // undocumented
    'repository',
    'scripts',
    'snyc', // inofficial - extension for snyc package
    'type', // undocumented - specifies esm/cjs mode
    'types', // undocumented - seems to specify typescript type.d.tx file
    'version',
    'workspaces',
];

async function getPackageJson(context) {
    console.log('[init] getting package.json');

    const packageJson = await common.getFile(context, '/package.json');
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
    console.log('\n[E001 - E099] checking package.json');

    let passed;

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

    // check if only allowed objects exist at package.json
    passed = true;
    for (const objectName in context.packageJson) {
        if (objectName.startsWith('_')) {
            context.errors.push(
                `[E014] NPM information (attribute "${objectName}") found in package.json. Please remove all attributes starting with "_"`,
            );
            passed = false;
        } else if (!validObjectsPackageJson.includes(objectName)) {
            context.errors.push(`[E058] Attribute "${objectName}" at package.json is not supported. Please remove.`);
            passed = false;
        }
    }
    if (passed) {
        context.checks.push(`package.json does not contain unsupported objects.`);
    }

    for (const blacklist in blacklistPackageJson) {
        common.debug(`checking blacklist ${blacklist}`);
        let tmp = context.packageJson;
        let log = '';
        for (const element of blacklist.split('.')) {
            log = `${log}.${element}`;
            //common.debug(`   check ${log}`);
            tmp = tmp[element];
            if (!tmp) {
                //common.debug(`   ${log} does not exist`);
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
    }
    context.checks.push('blacklist for package.json checked.');

    if (context.packageJson.name === undefined) {
        context.errors.push(`[E008] No "name" key found in package.json.`);
    } else if (context.packageJson.name !== `iobroker.${adapterName.toLowerCase()}`) {
        context.errors.push(
            `[E020] Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}". Now is "${context.packageJson.name}"`,
        );
    } else {
        context.checks.push(
            `Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}".`,
        );
    }

    if (!context.packageJson.version) {
        context.errors.push('[E009] No "version" key found in the package.json');
    } else {
        context.checks.push('Version found in package.json');
    }

    if (!context.packageJson.description) {
        context.errors.push('[E010] No "description" key found in the package.json');
    } else {
        context.checks.push('Description found in package.json');
    }

    if (!context.packageJson.author) {
        context.errors.push('[E013] No "author" key found in the package.json');
    } else {
        context.checks.push('Author found in package.json');
    }

    // if (context.packageJson.licenses) {
    //     context.errors.push(
    //         '[E021] "licenses" in package.json are deprecated. Please remove and use "license": "NAME" field.',
    //     );
    // } else {
    //     context.checks.push('"licenses" not found in package.json');
    // }

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
        context.errors.push('[E017] No "repository" key found in the package.json');
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

    if (!context.packageJson.scripts) {
        context.errors.push('[E059] No "scripts" key found in the package.json');
    } else {
        context.checks.push('Scripts found in package.json');
    }

    if (context.packageJson.maintainers) {
        context.warnings.push(
            '[W051] "maintainers" attribute at package.json is not documented. Please use "contributors" attribute.',
        );
    } else {
        context.checks.push('maintainers not found in package.json');
    }

    if (context.packageJson.publishConfig) {
        context.warnings.push(
            '[S052] "publishConfig" attribute at package.json is not required in most cases. Please check and eventually remove.',
        );
        if (
            context.packageJson.publishConfig.registry &&
            context.packageJson.publishConfig.registry !== 'https://registry.npmjs.org'
        ) {
            context.errors.push(
                '[E053] "publishConfig.registry" mut point to "https://registry.npmjs.org" at package.json.',
            );
        } else {
            context.checks.push(
                'publishConfig.registry exists at package.json and points to "https://registry.npmjs.org"',
            );
        }
    } else {
        context.checks.push('publishConfig not found in package.json');
    }

    if (context.cfg.reservedAdapterNames.includes(adapterName)) {
        context.errors.push('[E022] Adapter name is reserved. Please rename adapter.');
    } else {
        context.checks.push('Adapter name is not reserved');
    }

    if (!context.cfg.onlyWWW && !context.packageJson.dependencies) {
        context.errors.push('[W030] No dependencies declared at package.json. Is this really correct?');
    }

    if (!context.packageJson.devDependencies) {
        context.errors.push('[E031] No devDependencies declared at package.json. Please correct package.json');
    }

    // check for blacklisted dependencies
    passed = true;
    if (context.packageJson.dependencies) {
        for (const blacklist in blacklistedDependenciesPackageJson) {
            if (
                blacklistedDependenciesPackageJson[blacklist].onlyWWW !== undefined &&
                blacklistedDependenciesPackageJson[blacklist].onlyWWW !== context.cfg.onlyWWW
            ) {
                continue;
            }

            // if (context.packageJson.dependencies[blacklist]) {
            //     if (blacklistedDependenciesPackageJson[blacklist].err) {
            //         context.errors.push(`[E050] ${blacklistedDependenciesPackageJson[blacklist].msg}`);
            //     } else {
            //         context.warnings.push(`[W050] ${blacklistedDependenciesPackageJson[blacklist].msg}`);
            //     }
            //     passed = false;
            // }
            const regexp = new RegExp(`^${blacklist}$`);
            for (const dependency in context.packageJson.dependencies) {
                if (regexp.test(dependency)) {
                    if (blacklistedDependenciesPackageJson[blacklist].err) {
                        context.errors.push(
                            `[E050] ${blacklistedDependenciesPackageJson[blacklist].msg}`.replace(
                                '${dependency}',
                                dependency,
                            ),
                        );
                    } else {
                        context.warnings.push(
                            `[W050] ${blacklistedDependenciesPackageJson[blacklist].msg}`.replace(
                                '${dependency}',
                                dependency,
                            ),
                        );
                    }
                    passed = false;
                }
            }
        }
    }
    if (passed) {
        context.checks.push(`Package.json does not contain blacklisted dependencies.`);
    }

    // check for blacklisted devDependencies
    passed = true;
    if (context.packageJson.devDependencies) {
        for (const blacklist in blacklistedDevDependenciesPackageJson) {
            if (
                blacklistedDevDependenciesPackageJson[blacklist].onlyWWW !== undefined &&
                blacklistedDevDependenciesPackageJson[blacklist].onlyWWW !== context.cfg.onlyWWW
            ) {
                continue;
            }

            // if (context.packageJson.devDependencies[blacklist]) {
            //     if (blacklistedDevDependenciesPackageJson[blacklist].err) {
            //         context.errors.push(`[E050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`);
            //     } else {
            //         context.warnings.push(`[W050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`);
            //     }
            //     passed = false;
            // }
            const regexp = new RegExp(`^${blacklist}$`);
            for (const devDependency in context.packageJson.devDependencies) {
                if (regexp.test(devDependency)) {
                    if (blacklistedDevDependenciesPackageJson[blacklist].err) {
                        context.errors.push(
                            `[E050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`.replace(
                                '${devDependency}',
                                devDependency,
                            ),
                        );
                    } else {
                        context.warnings.push(
                            `[W050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`.replace(
                                '${devDependency}',
                                devDependency,
                            ),
                        );
                    }
                    passed = false;
                }
            }
        }
    }
    if (passed) {
        context.checks.push(`Package.json does not contain blacklisted devDependencies.`);
    }

    // check for blacklisted peerDependencies
    passed = true;
    if (context.packageJson.peerDependencies) {
        for (const blacklist in blacklistedPeerDependenciesPackageJson) {
            if (
                blacklistedPeerDependenciesPackageJson[blacklist].onlyWWW !== undefined &&
                blacklistedPeerDependenciesPackageJson[blacklist].onlyWWW !== context.cfg.onlyWWW
            ) {
                continue;
            }

            if (context.packageJson.peerDependencies[blacklist]) {
                if (blacklistedPeerDependenciesPackageJson[blacklist].err) {
                    context.errors.push(`[E050] ${blacklistedPeerDependenciesPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W050] ${blacklistedPeerDependenciesPackageJson[blacklist].msg}`);
                }
                passed = false;
            }
        }
    }
    if (passed) {
        context.checks.push(`Package.json does not contain blacklisted peerDependencies.`);
    }

    // check for blacklisted optionalDependencies
    passed = true;
    if (context.packageJson.optionalDependencies) {
        for (const blacklist in blacklistedOptionalDependenciesPackageJson) {
            if (
                blacklistedOptionalDependenciesPackageJson[blacklist].onlyWWW !== undefined &&
                blacklistedOptionalDependenciesPackageJson[blacklist].onlyWWW !== context.cfg.onlyWWW
            ) {
                continue;
            }

            if (context.packageJson.optionalDependencies[blacklist]) {
                if (blacklistedOptionalDependenciesPackageJson[blacklist].err) {
                    context.errors.push(`[E052] ${blacklistedOptionalDependenciesPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W053] ${blacklistedOptionalDependenciesPackageJson[blacklist].msg}`);
                }
                passed = false;
            }
        }
    }
    if (passed) {
        context.checks.push(`Package.json does not contain blacklisted devDependencies.`);
    }

    // check for dependencies listed multiple times
    passed = true;
    if (context.packageJson.devDependencies) {
        for (const dependency in context.packageJson.devDependencies) {
            if (context.packageJson.dependencies && context.packageJson.dependencies[dependency]) {
                context.errors.push(`[E060] ${dependency} listed as dependency and as devDependency.`);
                passed = false;
            }
        }
    }
    if (context.packageJson.peerDependencies) {
        for (const dependency in context.packageJson.peerDependencies) {
            if (context.packageJson.dependencies && context.packageJson.dependencies[dependency]) {
                context.errors.push(`[E060] ${dependency} listed as dependency and as peerDependency.`);
                passed = false;
            }
            if (context.packageJson.devDependencies && context.packageJson.devDependencies[dependency]) {
                context.errors.push(`[E060] ${dependency} listed as devDependency and as peerDependency.`);
                passed = false;
            }
        }
    }
    if (context.packageJson.optionalDependencies) {
        for (const dependency in context.packageJson.optionalDependencies) {
            if (context.packageJson.dependencies && context.packageJson.dependencies[dependency]) {
                context.errors.push(`[E060] ${dependency} listed as dependency and as optionalDependency.`);
                passed = false;
            }
            if (context.packageJson.devDependencies && context.packageJson.devDependencies[dependency]) {
                context.errors.push(`[E060] ${dependency} listed as devDependency and as optionalDependency.`);
                passed = false;
            }
            if (context.packageJson.peerDependencies && context.packageJson.peerDependencies[dependency]) {
                context.errors.push(`[E060] ${dependency} listed as peerDependency and as optionalDependency.`);
                passed = false;
            }
        }
    }
    if (passed) {
        context.checks.push(`Package.json does not contain conflicting dependencies.`);
    }

    // check engines clause
    if (!context.cfg.onlyWWW) {
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
                        `[W027] Engines clause at package.json ({'engines' : { 'node' : '${nodeVal}' } }") is not parseable.`,
                    );
                } else {
                    common.debug(`node check: ${JSON.stringify(match.groups)}`);
                    if (match.groups.cmp !== '>' && match.groups.cmp !== '>=') {
                        context.warnings.push(
                            `[W028] Minimum node.js version ${recommendedNodeVersion} recommended. Please change "{'engines' : { 'node' >= '${match.groups.vers}' } }" to "{'engines' : { 'node' >= '${recommendedNodeVersion}' } }" at package.json.`,
                        );
                    } else {
                        if (!compareVersions.compare(match.groups.vers, requiredNodeVersion, '>=')) {
                            context.errors.push(
                                `[E029] Node.js ${requiredNodeVersion} is required as minimum, node.js ${recommendedNodeVersion} is recommended. Please change "{'engines' : { 'node' >= '${match.groups.vers}' } }" to "{'engines' : { 'node' >= '${requiredNodeVersion}' } }" at package.json.`,
                            );
                        } else if (!compareVersions.compare(match.groups.vers, recommendedNodeVersion, '>=')) {
                            context.warnings.push(
                                `[W028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" to "{'engines' : { 'node' >= '${recommendedNodeVersion}' } }" at package.json.`,
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

    // check dependcy requirements
    for (const dependency in dependenciesPackageJson) {
        common.debug(`checking dependency ${dependency} ...`);

        if (dependenciesPackageJson[dependency].onlyWWW === false && context.cfg.onlyWWW) {
            continue;
        }

        const requiredVersion = dependenciesPackageJson[dependency].required;
        const recommendedVersion = dependenciesPackageJson[dependency].recommended;
        const alternatives = dependenciesPackageJson[dependency].alternatives || [];
        const optional = !!dependenciesPackageJson[dependency].optional;
        const suggested = !!dependenciesPackageJson[dependency].suggested;
        const exists = !!context.packageJson.dependencies[`${dependency}`];
        let dependencyVersion = context.packageJson.dependencies[`${dependency}`] || '';
        dependencyVersion = dependencyVersion.replace(/[\^~]/, '').trim();

        common.debug(`    exists: ${exists}, optional: ${optional}, alternatives: [${alternatives}]`);

        if (exists) {
            // if dependency exists, version requirements must be met
            if (!compareVersions.compare(dependencyVersion, requiredVersion, '>=')) {
                context.errors.push(
                    `[E033] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum, ${recommendedVersion} is recommended. Please update dependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, recommendedVersion, '>=')) {
                context.warnings.push(
                    `[W034] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating dependencies at package.json`,
                );
            } else {
                context.checks.push(`dependency ${dependency} ${dependencyVersion} is ok`);
            }
        } else {
            // if dependency does not exist check if alternate exists
            let found = '';
            for (const alternative of alternatives) {
                if (context.packageJson.dependencies[`${alternative}`]) {
                    found = alternative;
                }
            }
            if (found) {
                context.checks.push(`dependency ${dependency} satisfied by ${found}`);
            } else if (optional) {
                context.checks.push(`dependency ${dependency} is optional`);
                if (suggested) {
                    context.warnings.push(`[S061] Consider using "${dependency}".`);
                }
            } else {
                context.errors.push(
                    `[E032] No dependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to dependencies at package.json`,
                );
            }
        }
    }
    context.checks.push('required dependencies checked.');

    // Check for outdated ESLint version and suggest @iobroker/eslint-config
    let w063Logged = false;
    if (context.packageJson.devDependencies && context.packageJson.devDependencies.eslint) {
        const eslintVersion = context.packageJson.devDependencies.eslint;
        let cleanVersion = eslintVersion.replace(/[~^]/g, ''); // Remove ^ and ~ prefixes

        if (common.validateSemver(cleanVersion) && compareVersions.compare(cleanVersion, '9.0.0', '<')) {
            context.warnings.push(
                `[W063] ESLint version ${eslintVersion} is outdated. Consider using @iobroker/eslint-config as described in https://github.com/ioBroker/eslint-config/blob/main/MIGRATION.md.`,
            );
            w063Logged = true;
        }
    }

    // check devDependcy requirements
    for (const dependency in devDependenciesPackageJson) {
        common.debug(`checking devDependency ${dependency} ...`);

        if (devDependenciesPackageJson[dependency].onlyWWW === false && context.cfg.onlyWWW) {
            continue;
        }

        const requiredVersion = devDependenciesPackageJson[dependency].required;
        const recommendedVersion = devDependenciesPackageJson[dependency].recommended;
        const alternatives = devDependenciesPackageJson[dependency].alternatives || [];
        const optional = !!devDependenciesPackageJson[dependency].optional;
        const suggested = !!devDependenciesPackageJson[dependency].suggested;
        const exists = !!context.packageJson.devDependencies[`${dependency}`];
        let dependencyVersion = context.packageJson.devDependencies[`${dependency}`] || '';
        dependencyVersion = dependencyVersion.replace(/[\^~]/, '');

        common.debug(`    exists: ${exists}, optional: ${optional}, alternatives: [${alternatives}]`);

        if (exists) {
            // if dependency exists, version requirements must be met
            if (!compareVersions.compare(dependencyVersion, requiredVersion, '>=')) {
                context.errors.push(
                    `[E036] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum,  ${recommendedVersion} is recommended. Please update devDependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, recommendedVersion, '>=')) {
                context.warnings.push(
                    `[W037] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating devDependencies at package.json`,
                );
            } else {
                context.checks.push(`devDependency ${dependency} ${dependencyVersion} is ok`);
            }
        } else {
            // if dependency does not existscheck if alternate exists
            let found = '';
            for (const alternative of alternatives) {
                if (context.packageJson.devDependencies[`${alternative}`]) {
                    found = alternative;
                }
            }
            if (found) {
                context.checks.push(`devDependency ${dependency} satisfied by ${found}`);
            } else if (optional) {
                context.checks.push(`devDependency ${dependency} is optional`);
                if (suggested) {
                    // Suppress S062 for @iobroker/eslint-config if W063 was logged
                    if (dependency === '@iobroker/eslint-config' && w063Logged) {
                        // Don't log S062 when W063 was already logged
                    } else {
                        context.warnings.push(`[S062] Consider using "${dependency}".`);
                    }
                }
            } else {
                context.errors.push(
                    `[E035] No devDependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to devDependencies at package.json`,
                );
            }
        }
    }
    context.checks.push('required devDependencies have been checked.');

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
        const dependencyVersion = context.packageJson.dependencies[dependency];
        if (dependencyVersion.toLowerCase().includes('github.com')) {
            context.warnings.push(
                `[W043] dependency should not require a github version. Please change "${dependency}:${dependencyVersion}"`,
            );
        } else if (dependencyVersion === '*') {
            context.warnings.push(
                `[W056] Wildcard dependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
            );
        } else if (!common.validateSemver(dependencyVersion)) {
            context.errors.push(
                `[E054] malformed dependency detected "${dependency}":"${dependencyVersion}". Please fix at package.json.`,
            );
        } else if (
            !context.packageJson.dependencies[dependency].startsWith('^') &&
            !context.packageJson.dependencies[dependency].startsWith('~') &&
            !context.packageJson.dependencies[dependency].startsWith('>') &&
            !context.packageJson.dependencies[dependency].startsWith('<')
        ) {
            if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E044] dependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"`,
                );
            } else {
                context.warnings.push(
                    `[S047] dependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"`,
                );
            }
        }
    }

    for (const dependency in context.packageJson.devDependencies) {
        const dependencyVersion = context.packageJson.devDependencies[dependency];
        if (dependencyVersion.toLowerCase().includes('github.com')) {
            context.warnings.push(
                `[W045] devDependency should not require github versions. Please change "${dependency}":"${dependencyVersion}"`,
            );
        } else if (dependencyVersion === '*') {
            context.warnings.push(
                `[W057] Wildcard devDependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
            );
        } else if (!common.validateSemver(dependencyVersion)) {
            context.errors.push(
                `[E055] malformed dependency detected "${dependency}":"${dependencyVersion}". Please fix at package.json.`,
            );
        } else if (
            !context.packageJson.devDependencies[dependency].startsWith('^') &&
            !context.packageJson.devDependencies[dependency].startsWith('~') &&
            !context.packageJson.devDependencies[dependency].startsWith('>') &&
            !context.packageJson.devDependencies[dependency].startsWith('<')
        ) {
            if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E046] devDependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${dependencyVersion}"`,
                );
            } else {
                context.warnings.push(
                    `[W048] devDependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"`,
                );
            }
        }
    }

    // Check for conflicting eslint/prettier packages when @iobroker/eslint-config is used
    if (context.packageJson.devDependencies && context.packageJson.devDependencies['@iobroker/eslint-config']) {
        const conflictingPackages = [];

        // Check for ESLint packages that should be removed (W064)
        const eslintPackages = [
            'eslint',
            'eslint-config-prettier',
            'eslint-plugin-prettier',
            '@eslint/eslintrc',
            '@eslint/js',
            '@typescript-eslint/eslint-plugin',
            '@typescript-eslint/parser',
        ];
        eslintPackages.forEach(pkg => {
            if (context.packageJson.devDependencies[pkg]) {
                conflictingPackages.push(pkg);
            }
        });

        // Check for Prettier packages
        const prettierPackages = ['prettier'];
        prettierPackages.forEach(pkg => {
            if (context.packageJson.devDependencies[pkg]) {
                conflictingPackages.push(pkg);
            }
        });

        if (conflictingPackages.length > 0) {
            context.warnings.push(
                `[W064] When using @iobroker/eslint-config, the following packages should be removed from devDependencies: ${conflictingPackages.join(', ')}.`,
            );
        }

        // Check for other @eslint/* and @typescript-eslint/* packages for suggestion (S064)
        const suggestedPackages = [];

        Object.keys(context.packageJson.devDependencies).forEach(pkg => {
            // Skip packages already handled by W064
            if (conflictingPackages.includes(pkg)) {
                return;
            }

            // Check for @eslint/* packages
            if (pkg.startsWith('@eslint/')) {
                suggestedPackages.push(pkg);
            }

            // Check for @typescript-eslint/* packages
            if (pkg.startsWith('@typescript-eslint/')) {
                suggestedPackages.push(pkg);
            }
        });

        if (suggestedPackages.length > 0) {
            context.warnings.push(
                `[S064] When using @iobroker/eslint-config, consider removing the following packages from devDependencies: ${suggestedPackages.join(', ')}.`,
            );
        }
    }

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
        if (!(recommendedKeywords.filter(keyword => context.packageJson.keywords.includes(keyword)).length > 0)) {
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
// E008] No "name" key found in package.json.
// [009] No "version" key found in the package.json
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
// [050] ${blacklistedDependenciesPackageJson[blacklist].msg}
// [051] "maintainers" attribute at package.json is not documented. Please use "contributors" attribute',
// [052] --
// [053] --
// [054] malformed dependency detected "${dependency}":${context.packageJson.dependencies[dependency]}". Please fix at package.json.`
// [055] malformed dependency detected "${dependency}":${context.packageJson.devDependencies[dependency]}". Please fix at package.json.`
// [056] Wildcard dependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
// [057] Wildcard devDependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
// [058] Key ${objectName} at package.json is not supported. Please remove.
// [059] No "scripts" key found in the package.json.
// [060] ${dependency} listed as dependency and as devDependency.
// [061] Consider using "${dependency}".
// [062] No devDependency declared for ${dependency}. Please consider adding "${dependency}":"${recommendedVersion}" to devDependencies at package.json`
// [063] ESLint version ${eslintVersion} is outdated. Consider using @iobroker/eslint-config as described in https://github.com/ioBroker/eslint-config/blob/main/MIGRATION.md.
// [064] When using @iobroker/eslint-config, the following packages should be removed from devDependencies: ${conflictingPackages.join(', ')}.
// [S064] When using @iobroker/eslint-config, consider removing the following packages from devDependencies: ${suggestedPackages.join(', ')}.

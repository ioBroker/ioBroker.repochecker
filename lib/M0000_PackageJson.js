'use strict';

/*
    This module is a support module for iobroker.repochecker

    Area checked:   package.json
    Numbering   :   0001 - 0099

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
        actual: '3.3.2',
        onlyWWW: false,
    },
};

// packages which must or should be required as devDependencies
const devDependenciesPackageJson = {
    '@alcalzone/release-script': {
        required: '3.8.0',
        recommended: '3.8.0',
        actual: '3.8.0',
        optional: true,
        suggested: true,
    },
    '@iobroker/adapter-dev': {
        required: '1.3.0',
        recommended: '1.4.0',
        actual: '1.5.0',
        onlyWWW: false,
        optional: true,
        suggested: true,
    },
    '@iobroker/eslint-config': {
        required: '2.0.0',
        recommended: '2.2.0',
        actual: '2.2.0',
        onlyWWW: false,
        optional: true,
        suggested: true,
    },
    '@iobroker/legacy-testing': {
        required: '2.0.2',
        recommended: '2.0.2',
        actual: '2.0.2',
        onlyWWW: false,
        optional: true,
    },
    '@iobroker/testing': {
        required: '4.1.3',
        recommended: '5.1.1',
        actual: '5.1.1',
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
        msg: "'request' package is deprecated and no longer maintained. Consider migrating to native 'node:fetch' or 'axios' if more complex functionality is needed.",
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

/**
 * Validates release format according to ioBroker semver subset requirements
 *
 * @param {string} version - Version string to validate
 * @returns {boolean} true if valid, false if invalid
 */
function validateReleaseFormat(version) {
    if (!version || typeof version !== 'string') {
        return false;
    }

    // Regex to match the specified format:
    // - version must consist of 3 digits separated by a dot
    // - optionally followed by a Prerelease-Identifier, a dot and a Prerelease version
    // - all numbers must not have leading zeroes (except single zero)
    // - Prerelease-Identifier must only contain characters, numbers and a minus sign ([a-zA-Z0-9-])
    // - Prerelease version must be a number without leading zeroes
    // - empty fields resulting in two or more dots following each other are not valid

    const regex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([a-zA-Z0-9-]+)\.(0|[1-9]\d*))?$/;

    const match = version.match(regex);
    if (!match) {
        return false;
    }

    const [, , , , prereleaseId, prereleaseVersion] = match;

    // Additional validation for prerelease identifier
    if (prereleaseId !== undefined) {
        // Ensure prerelease identifier is valid:
        // - cannot be only numbers (RC5 is invalid)
        // - cannot end with numbers (RC5 is invalid, RC is valid)
        if (/^\d+$/.test(prereleaseId) || /\d+$/.test(prereleaseId)) {
            return false;
        }

        // Ensure prerelease version is provided when prerelease ID is present
        if (prereleaseVersion === undefined) {
            return false;
        }
    }

    return true;
}

async function getPackageJson(context) {
    console.log('[init] getting package.json');

    const packageJson = await common.getFile(context, '/package.json');
    context.packageJson = packageJson;
    if (typeof context.packageJson === 'string') {
        try {
            context.packageJson = JSON.parse(context.packageJson);
        } catch (e) {
            context.errors.push(`[E0001] Cannot parse package.json: ${e}`);
        }
    }

    // calculate adapternam here as it is needed by others

    let m;
    m = context.githubApiData.name.match(/^ioBroker\.(.*)$/);
    if (!m || !m[1]) {
        m = context.githubApiData.name.match(/^iobroker\.(.*)$/);
    }
    let adapterName = '';
    if (!m || !m[1]) {
        context.errors.push(`[E0004] No valid adapter name found in URL: ${context.githubUrlOriginal}`);
    } else {
        context.checks.push('Adapter name found in the URL');
        adapterName = m[1].replace(/\/master$/, '').replace(/\/main$/, '');
    }

    context.adapterName = adapterName !== '' ? adapterName : 'unknown';

    return context;
}

async function checkPackageJson(context) {
    console.log('\n[E0001 - E0999] checking package.json');

    let passed;

    //if (!context.githubUrlOriginal.match(/\/iobroker\./i)) {
    //console.log(`DEBUG: ${context.githubApiData.name}`)
    if (!context.githubApiData.name.match(/^iobroker\./i)) {
        context.errors.push('[E0002] No "ioBroker." found in the name of repository');
    } else {
        context.checks.push('"ioBroker" was found in the name of repository');
    }

    //if (context.githubUrlOriginal.includes('/iobroker.')) {
    if (context.githubApiData.name.match(/^iobroker\./)) {
        context.errors.push(
            '[E0003] Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase',
        );
    } else {
        context.checks.push('Repository has name ioBroker.adaptername (not iobroker.adaptername)');
    }

    // //const m = context.githubUrlOriginal.match(/\/ioBroker\.(.*)$/);
    // let m;
    // m = context.githubApiData.name.match(/^ioBroker\.(.*)$/);
    // if (!m || !m[1]) {
    //     m = context.githubApiData.name.match(/^iobroker\.(.*)$/);
    // }
    // let adapterName = '';
    // if (!m || !m[1]) {
    //     context.errors.push(`[E0004] No valid adapter name found in URL: ${context.githubUrlOriginal}`);
    // } else {
    //     context.checks.push('Adapter name found in the URL');
    //     adapterName = m[1].replace(/\/master$/, '').replace(/\/main$/, '');
    // }

    // context.adapterName = adapterName !== '' ? adapterName : 'unknown';

    const adapterName = context.adapterName;

    if (adapterName.match(/[A-Z]/)) {
        context.errors.push('[E0005] Adapter name must be lowercase');
    } else {
        context.checks.push('Adapter name is lowercase');
    }

    if (adapterName.match(/[^-_a-z\d]/)) {
        context.errors.push(
            `[E0006] Invalid characters found in adapter name "${adapterName}". Only lowercase chars, digits, "-" and "_" are allowed`,
        );
    } else {
        context.checks.push(`No invalid characters found in "${adapterName}"`);
    }

    if (adapterName.startsWith('_')) {
        context.errors.push(`[E0024] Adapter name "${adapterName}" may not start with '_'`);
    } else {
        context.checks.push(`Adapter name "${adapterName}" does not start with '_'`);
    }

    const n = context.githubUrlOriginal.match(/\/([^/]+)\/iobroker\./i);
    if (!n || !n[1]) {
        context.errors.push('[E0007] Cannot find author repo in the URL');
    } else {
        context.authorName = n[1];
    }

    // check if only allowed objects exist at package.json
    passed = true;
    for (const objectName in context.packageJson) {
        if (objectName.startsWith('_')) {
            context.errors.push(
                `[E0014] NPM information (attribute "${objectName}") found in package.json. Please remove all attributes starting with "_"`,
            );
            passed = false;
        } else if (!validObjectsPackageJson.includes(objectName)) {
            context.errors.push(`[E0058] Attribute "${objectName}" at package.json is not supported. Please remove.`);
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
                context.errors.push(`[E0038] ${blacklistPackageJson[blacklist].msg}`);
            } else {
                context.warnings.push(`[W0038] ${blacklistPackageJson[blacklist].msg}`);
            }
        }
    }
    context.checks.push('blacklist for package.json checked.');

    if (context.packageJson.name === undefined) {
        context.errors.push(`[E0008] No "name" key found in package.json.`);
    } else if (context.packageJson.name !== `iobroker.${adapterName.toLowerCase()}`) {
        context.errors.push(
            `[E0020] Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}". Now is "${context.packageJson.name}"`,
        );
    } else {
        context.checks.push(
            `Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}".`,
        );
    }

    if (!context.packageJson.version) {
        context.errors.push('[E0009] No "version" key found in the package.json');
    } else {
        context.checks.push('Version found in package.json');

        // Validate version format according to ioBroker requirements
        if (!validateReleaseFormat(context.packageJson.version)) {
            context.errors.push(
                `[E0061] Invalid version format "${context.packageJson.version}". Version must follow semver format: MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-PRERELEASE.NUMBER (e.g., "1.2.3" or "1.2.3-alpha.4").`,
            );
        } else {
            context.checks.push('Version format is valid');
        }
    }

    if (!context.packageJson.description) {
        context.errors.push('[E0010] No "description" key found in the package.json');
    } else {
        context.checks.push('Description found in package.json');
    }

    if (!context.packageJson.author) {
        context.errors.push('[E0013] No "author" key found in the package.json');
    } else {
        context.checks.push('Author found in package.json');
    }

    // if (context.packageJson.licenses) {
    //     context.errors.push(
    //         '[E0021] "licenses" in package.json are deprecated. Please remove and use "license": "NAME" field.',
    //     );
    // } else {
    //     context.checks.push('"licenses" not found in package.json');
    // }

    if (!context.packageJson.license) {
        context.errors.push('[E0015] No license found in package.json');
    } else {
        context.checks.push('"license" found in package.json');

        // check if license valid
        if (!context.cfg.allowedLicenses.includes(context.packageJson.license)) {
            context.errors.push(
                `[E0016] ${context.packageJson.license} found in package.json is no valid SPDX license. Please use one of listed here: https://spdx.org/licenses/`,
            );
        } else {
            context.checks.push('"license" is valid in package.json');
        }
    }

    if (!context.packageJson.repository) {
        context.errors.push('[E0017] No "repository" key found in the package.json');
    } else {
        context.checks.push('Repository found in package.json');

        const allowedRepoUrls = [
            context.githubApiData.html_url.replace('/iobroker.', '/ioBroker.'), // https://github.com/klein0r/ioBroker.luftdaten
            `git+${context.githubApiData.html_url.replace('/iobroker.', '/ioBroker.')}`, // git+https://github.com/klein0r/ioBroker.luftdaten
            context.githubApiData.git_url.replace('/iobroker.', '/ioBroker.'), // git://github.com/klein0r/ioBroker.luftdaten.git
            context.githubApiData.ssh_url.replace('/iobroker.', '/ioBroker.'), // git@github.com:klein0r/ioBroker.luftdaten.git
            context.githubApiData.clone_url.replace('/iobroker.', '/ioBroker.'), // https://github.com/klein0r/ioBroker.luftdaten.git
            `git+${context.githubApiData.clone_url.replace('/iobroker.', '/ioBroker.')}`, // git+https://github.com/klein0r/ioBroker.luftdaten.git
        ];

        // https://docs.npmjs.com/cli/v7/configuring-npm/package-json#repository
        if (context.packageJson.repository && typeof context.packageJson.repository === 'object') {
            if (context.packageJson.repository.type !== 'git') {
                context.errors.push(
                    `[E0018] Invalid repository type in package.json: ${context.packageJson.repository.type}. It should be git`,
                );
            } else {
                context.checks.push('Repository type is valid in package.json: git');
            }

            if (!allowedRepoUrls.includes(context.packageJson.repository.url)) {
                context.errors.push(
                    `[E0019] Invalid repository URL in package.json: ${context.packageJson.repository.url}. Expected: ${context.githubApiData.clone_url}`,
                );
            } else {
                context.checks.push('Repository URL is valid in package.json');
            }
        } else if (context.packageJson.repository && typeof context.packageJson.repository === 'string') {
            if (!allowedRepoUrls.includes(context.packageJson.repository)) {
                context.errors.push(
                    `[E0019] Invalid repository URL in package.json: ${context.packageJson.repository}. Expected: ${context.githubApiData.clone_url}`,
                );
            } else {
                context.checks.push('Repository URL is valid in package.json');
            }
        } else {
            context.errors.push('[E0012] Invalid repository object in package.json');
        }
    }

    if (!context.packageJson.scripts) {
        context.errors.push('[E0059] No "scripts" key found in the package.json');
    } else {
        context.checks.push('Scripts found in package.json');
    }

    if (context.packageJson.maintainers) {
        context.warnings.push(
            '[W0051] "maintainers" attribute at package.json is not documented. Please use "contributors" attribute.',
        );
    } else {
        context.checks.push('maintainers not found in package.json');
    }

    if (context.packageJson.publishConfig) {
        context.warnings.push(
            '[S0052] "publishConfig" attribute at package.json is not required in most cases. Please check and eventually remove.',
        );
        if (
            context.packageJson.publishConfig.registry &&
            context.packageJson.publishConfig.registry !== 'https://registry.npmjs.org'
        ) {
            context.errors.push(
                '[E0053] "publishConfig.registry" mut point to "https://registry.npmjs.org" at package.json.',
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
        context.errors.push('[E0022] Adapter name is reserved. Please rename adapter.');
    } else {
        context.checks.push('Adapter name is not reserved');
    }

    if (!context.cfg.onlyWWW && !context.packageJson.dependencies) {
        context.errors.push('[W0030] No dependencies declared at package.json. Is this really correct?');
    }

    if (!context.packageJson.devDependencies) {
        context.errors.push('[E0031] No devDependencies declared at package.json. Please correct package.json');
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
            //         context.errors.push(`[E0050] ${blacklistedDependenciesPackageJson[blacklist].msg}`);
            //     } else {
            //         context.warnings.push(`[W0050] ${blacklistedDependenciesPackageJson[blacklist].msg}`);
            //     }
            //     passed = false;
            // }
            const regexp = new RegExp(`^${blacklist}$`);
            for (const dependency in context.packageJson.dependencies) {
                if (regexp.test(dependency)) {
                    if (blacklistedDependenciesPackageJson[blacklist].err) {
                        context.errors.push(
                            `[E0050] ${blacklistedDependenciesPackageJson[blacklist].msg}`.replace(
                                '${dependency}',
                                dependency,
                            ),
                        );
                    } else {
                        context.warnings.push(
                            `[W0050] ${blacklistedDependenciesPackageJson[blacklist].msg}`.replace(
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
            //         context.errors.push(`[E0050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`);
            //     } else {
            //         context.warnings.push(`[W0050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`);
            //     }
            //     passed = false;
            // }
            const regexp = new RegExp(`^${blacklist}$`);
            for (const devDependency in context.packageJson.devDependencies) {
                if (regexp.test(devDependency)) {
                    if (blacklistedDevDependenciesPackageJson[blacklist].err) {
                        context.errors.push(
                            `[E0050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`.replace(
                                '${devDependency}',
                                devDependency,
                            ),
                        );
                    } else {
                        context.warnings.push(
                            `[W0050] ${blacklistedDevDependenciesPackageJson[blacklist].msg}`.replace(
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
                    context.errors.push(`[E0050] ${blacklistedPeerDependenciesPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W0050] ${blacklistedPeerDependenciesPackageJson[blacklist].msg}`);
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
                    context.errors.push(`[E0052] ${blacklistedOptionalDependenciesPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W0053] ${blacklistedOptionalDependenciesPackageJson[blacklist].msg}`);
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
                context.errors.push(`[E0060] ${dependency} listed as dependency and as devDependency.`);
                passed = false;
            }
        }
    }
    if (context.packageJson.peerDependencies) {
        for (const dependency in context.packageJson.peerDependencies) {
            if (context.packageJson.dependencies && context.packageJson.dependencies[dependency]) {
                context.errors.push(`[E0060] ${dependency} listed as dependency and as peerDependency.`);
                passed = false;
            }
            if (context.packageJson.devDependencies && context.packageJson.devDependencies[dependency]) {
                context.errors.push(`[E0060] ${dependency} listed as devDependency and as peerDependency.`);
                passed = false;
            }
        }
    }
    if (context.packageJson.optionalDependencies) {
        for (const dependency in context.packageJson.optionalDependencies) {
            if (context.packageJson.dependencies && context.packageJson.dependencies[dependency]) {
                context.errors.push(`[E0060] ${dependency} listed as dependency and as optionalDependency.`);
                passed = false;
            }
            if (context.packageJson.devDependencies && context.packageJson.devDependencies[dependency]) {
                context.errors.push(`[E0060] ${dependency} listed as devDependency and as optionalDependency.`);
                passed = false;
            }
            if (context.packageJson.peerDependencies && context.packageJson.peerDependencies[dependency]) {
                context.errors.push(`[E0060] ${dependency} listed as peerDependency and as optionalDependency.`);
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
                `[E0026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended`,
            );
        } else {
            if (!context.packageJson.engines.node) {
                context.errors.push(
                    `[E0026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended`,
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
                        `[W0027] Engines clause at package.json ({'engines' : { 'node' : '${nodeVal}' } }") is not parseable.`,
                    );
                } else {
                    common.debug(`node check: ${JSON.stringify(match.groups)}`);
                    if (match.groups.cmp !== '>' && match.groups.cmp !== '>=') {
                        context.warnings.push(
                            `[W0028] Minimum node.js version ${recommendedNodeVersion} recommended. Please change "{'engines' : { 'node' >= '${match.groups.vers}' } }" to "{'engines' : { 'node' >= '${recommendedNodeVersion}' } }" at package.json.`,
                        );
                    } else {
                        if (!compareVersions.compare(match.groups.vers, requiredNodeVersion, '>=')) {
                            context.errors.push(
                                `[E0029] Node.js ${requiredNodeVersion} is required as minimum, node.js ${recommendedNodeVersion} is recommended. Please change "{'engines' : { 'node' >= '${match.groups.vers}' } }" to "{'engines' : { 'node' >= '${requiredNodeVersion}' } }" at package.json.`,
                            );
                        } else if (!compareVersions.compare(match.groups.vers, recommendedNodeVersion, '>=')) {
                            context.warnings.push(
                                `[W0028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" to "{'engines' : { 'node' >= '${recommendedNodeVersion}' } }" at package.json.`,
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
        const actualVersion = dependenciesPackageJson[dependency].actual;
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
                    `[E0033] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum, ${actualVersion} (or newer) is current. Please update dependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, recommendedVersion, '>=')) {
                context.warnings.push(
                    `[W0034] ${dependency} ${dependencyVersion} specified. ${actualVersion} (or newer) is current. Please update dependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, actualVersion, '>=')) {
                context.warnings.push(
                    `[S0064] ${dependency} ${dependencyVersion} specified. Newer version ${actualVersion} exists.`,
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
                    context.warnings.push(`[S0061] Consider using "${dependency}".`);
                }
            } else {
                context.errors.push(
                    `[E0032] No dependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to dependencies at package.json`,
                );
            }
        }
    }
    context.checks.push('required dependencies checked.');

    // check devDependcy requirements
    for (const dependency in devDependenciesPackageJson) {
        common.debug(`checking devDependency ${dependency} ...`);

        if (devDependenciesPackageJson[dependency].onlyWWW === false && context.cfg.onlyWWW) {
            continue;
        }

        const requiredVersion = devDependenciesPackageJson[dependency].required;
        const recommendedVersion = devDependenciesPackageJson[dependency].recommended;
        const actualVersion = devDependenciesPackageJson[dependency].actual;
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
                    `[E0036] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum,  ${actualVersion} (or newer) is current. Please update devDependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, recommendedVersion, '>=')) {
                context.warnings.push(
                    `[W0037] ${dependency} ${dependencyVersion} specified. ${actualVersion} (or newer) is current. Please update devDependencies at package.json`,
                );
            } else if (!compareVersions.compare(dependencyVersion, actualVersion, '>=')) {
                context.warnings.push(
                    `[S0064] ${dependency} ${dependencyVersion} specified. Newer version ${actualVersion} exists.`,
                );
            } else {
                context.checks.push(`devDependency ${dependency} ${dependencyVersion} is ok`);
            }
        } else {
            // if dependency does not exist - check if alternate exists
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
                    context.warnings.push(`[S0062] Consider using "${dependency}".`);
                }
            } else {
                context.errors.push(
                    `[E0035] No devDependency declared for ${dependency}. Please add "${dependency}":"${actualVersion}" to devDependencies at package.json`,
                );
            }
        }
    }
    context.checks.push('required devDependencies have been checked.');

    // Check for unneeded devDependencies when @iobroker/testing >= 5.1.1 is installed
    if (context.packageJson.devDependencies['@iobroker/testing']) {
        const testingVersion = context.packageJson.devDependencies['@iobroker/testing'].replace(/[\^~]/, '').trim();
        try {
            if (compareVersions.compare(testingVersion, '5.1.1', '>=')) {
                // List of packages that are redundant when @iobroker/testing >= 5.1.1 is installed
                const redundantPackages = [
                    '@types/chai',
                    'chai',
                    '@types/chai-as-promised',
                    'chai-as-promised',
                    '@types/mocha',
                    'mocha',
                    '@types/sinon',
                    'sinon',
                    // '@types/proxyquire',
                    // 'proxyquire',
                    '@types/sinon-chai',
                    'sinon-chai',
                ];

                let pkgs = [];
                for (const pkg of redundantPackages) {
                    if (context.packageJson.devDependencies[pkg]) {
                        pkgs.push(pkg);
                    }
                    if (pkgs.length >= 4) {
                        context.warnings.push(
                            `[W0063] "${pkgs.join(', ')}" are included by "@iobroker/testing". Remove from devDependencies at package.json`,
                        );
                        pkgs = [];
                    }
                }
                if (pkgs.length) {
                    context.warnings.push(
                        `[W0063] "${pkgs.join(', ')}" are included in "@iobroker/testing". Remove from devDependencies at package.json`,
                    );
                }
            }
        } catch (e) {
            // Version comparison failed, skip this check
            common.debug(`Could not compare @iobroker/testing version: ${e}`);
        }
    }

    const enforcedDependencies = [
        '@iobroker/adapter-core',
        '@alcalzone/release-script',
        '@alcalzone/release-script-plugin-iobroker',
        '@alcalzone/release-script-plugin-license',
        '@alcalzone/release-script-manual-review',
        '@iobroker/adapter-dev',
        '@iobroker/testing',
    ];
    let forcedDependencyFlag = false;
    for (const dependency in context.packageJson.dependencies) {
        const dependencyVersion = context.packageJson.dependencies[dependency];
        if (dependencyVersion.toLowerCase().includes('github.com')) {
            context.warnings.push(
                `[W0043] dependency should not require a github version. Please change "${dependency}:${dependencyVersion}"`,
            );
        } else if (dependencyVersion === '*') {
            context.warnings.push(
                `[W0056] Wildcard dependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
            );
        } else if (!common.validateSemver(dependencyVersion)) {
            context.errors.push(
                `[E0054] malformed dependency detected "${dependency}":"${dependencyVersion}". Please fix at package.json.`,
            );
        } else if (
            !context.packageJson.dependencies[dependency].startsWith('^') &&
            !context.packageJson.dependencies[dependency].startsWith('~') &&
            !context.packageJson.dependencies[dependency].startsWith('>') &&
            !context.packageJson.dependencies[dependency].startsWith('<')
        ) {
            if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E0044] dependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"`,
                );
            } else {
                forcedDependencyFlag = true;
                // context.warnings.push(
                //     `[S0047] dependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"`,
                // );
            }
        }
    }
    if (forcedDependencyFlag) {
        context.warnings.push(
            `[S0047] At least one dependency at package.json requires a specific version. Consider using "~1.2.3" or "^1.2.3" syntax unless freezing dependencies is really desired.`,
        );
    }

    let forcedDevDependencyFlag = false;
    for (const dependency in context.packageJson.devDependencies) {
        const dependencyVersion = context.packageJson.devDependencies[dependency];
        if (dependencyVersion.toLowerCase().includes('github.com')) {
            context.warnings.push(
                `[W0045] devDependency should not require github versions. Please change "${dependency}":"${dependencyVersion}"`,
            );
        } else if (dependencyVersion === '*') {
            context.warnings.push(
                `[W0057] Wildcard devDependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
            );
        } else if (!common.validateSemver(dependencyVersion)) {
            context.errors.push(
                `[E0055] malformed dependency detected "${dependency}":"${dependencyVersion}". Please fix at package.json.`,
            );
        } else if (
            !context.packageJson.devDependencies[dependency].startsWith('^') &&
            !context.packageJson.devDependencies[dependency].startsWith('~') &&
            !context.packageJson.devDependencies[dependency].startsWith('>') &&
            !context.packageJson.devDependencies[dependency].startsWith('<')
        ) {
            if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E0046] devDependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${dependencyVersion}"`,
                );
            } else {
                forcedDevDependencyFlag = true;
                // context.warnings.push(
                //     `[W0048] devDependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"`,
                // );
            }
        }
    }
    if (forcedDevDependencyFlag) {
        context.warnings.push(
            `[S0048] At least one devDpendency at package.json requires a specific version. Consider using "~1.2.3" or "^1.2.3" syntax unless freezing dependencies is really desired.`,
        );
    }

    if (!context.packageJson.keywords || !Array.isArray(context.packageJson.keywords)) {
        context.errors.push('[E0039] "keywords" must be an array within package.json and contain some useful keywords');
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
                `[E0049] "keywords" within package.json must contain some keywords besides "${context.packageJson.keywords.join(', ')}" related to adapter`,
            );
        }
        if (!(recommendedKeywords.filter(keyword => context.packageJson.keywords.includes(keyword)).length > 0)) {
            context.warnings.push(
                `[W0040] "keywords" within package.json should contain "${recommendedKeywords.join(', ')}"`,
            );
        }
        if (
            forbiddenKeywords.filter(keyword =>
                context.packageJson.keywords.map(k => k.toLowerCase()).includes(keyword),
            ).length > 0
        ) {
            context.warnings.push(
                `[W0041] "keywords" within package.json should not contain "${forbiddenKeywords.join(', ')}"`,
            );
        }

        context.checks.push('"keywords" found in package.json and refers to an array');
    }

    if (context.packageJson.globalDependencies) {
        context.errors.push(
            '[E0042] "globalDependencies" is misplaced at package.json. Did you mean "common.globalDependencies" at io-package.json?',
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
exports.validateReleaseFormat = validateReleaseFormat;

// List of error and warnings used at this module
// ----------------------------------------------

// [0001] Cannot parse package.json: ${e}
// [0002] No "ioBroker." found in the name of repository
// [0003] Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase
// [0004] No adapter name found in URL: ${context.githubUrlOriginal}
// [0005] Adapter name must be lowercase
// [0006] Invalid characters found in adapter name "${adapterName}". Only lowercase chars, digits, "-" and "_" are allowed
// [0007] Cannot find author repo in the URL
// E008] No "name" key found in package.json.
// [0009] No "version" key found in the package.json
// [0010] No description found in the package.json
// [0011] ### "@iobroker/dev-server" must not be listed as dependency at package.json'
// [0012] Invalid repository object in package.json
// [0013] No author found in the package.json
// [0014] NPM information found in package.json. Please remove all attributes starting with "_"
// [0015] No license found in package.json
// [0016] ${context.packageJson.license} found in package.json is no valid SPDX license. Please use one of listed here: https://spdx.org/licenses/
// [0017] No repository found in the package.json
// [0018] Invalid repository type in package.json: ${context.packageJson.repository.type}. It should be git
// [0019] Invalid repository URL in package.json: ${context.packageJson.repository.url}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}
// [0019] Invalid repository URL in package.json: ${context.packageJson.repository}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}
// [0020] Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}". Now is "${packageJson.name}"
// [0021] "licenses" in package.json are deprecated. Please remove and use "license": "NAME" field.
// [0022] Adapter name is reserved. Please rename adapter.
// [0023] ### Do not include "npm" as dependency!
// [0024] Adapter name "${adapterName}" may not start with '_'y!
// [0025] ### "iobroker.js-controller" must not be listed as dependency at package.json'
// [0026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended
// [0026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommended
// [0027] Engines clause at at package.json ({'engines' : { 'node' : '${nodeVal}' } }") is not parseable.
// [0028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.
// [0028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.
// [0029] Node.js ${requiredNodeVersion} is required as minimum, node.js ${recommendedNodeVersion} is recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.
// [0030] No dependencies declared at package.json. Is this really correct?
// [0031] No devDependencies declared at package.json. Please correct package.json
// [0032] No dependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to dependencies at package.json
// [0033] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum, ${recommendedVersion} is recommended. Please update dependencies at package.json
// [0034] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating dependencies at package.json
// [0035] No devDependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to devDependencies at package.json
// [0036] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum,  ${recommendedVersion} is recommended. Please update devDependencies at package.json
// [0037] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating devDependencies at package.json
// [0038] ${blacklistPackageJson[blacklist].msg}
// [0038] ${blacklistPackageJson[blacklist].msg}
// [0039] "keywords" must be an array within package.json and contain some useful keywords
// [0040] "keywords" within package.json should contain "${recommendedKeywords.join(', ')}"
// [0041] "keywords" within package.json should not contain "${forbiddenKeywords.join(', ')}"
// [0042] "globalDependencies" is misplaced at package.json. Did you mean "common.globalDependencies" at io-package.json?
// [0043] dependency should not require a github version. Please change "${dependency}:${context.packageJson.dependencies[dependency]}"
// [0044] dependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"
// [0045] devDependency should not require github versions. Please change "${dependency}:${context.packageJson.devDependencies[dependency]}"
// [0046] devDependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"
// [0047] dependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.dependencies[dependency]}"
// [0048] devDependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${context.packageJson.devDependencies[dependency]}"
// [0049] "keywords" within package.json must contain some keywords besides "${context.packageJson.keywords.join(', ')}" related to adapter
// [0050] ${blacklistedDependenciesPackageJson[blacklist].msg}
// [0051] "maintainers" attribute at package.json is not documented. Please use "contributors" attribute',
// [0052] --
// [0053] --
// [0054] malformed dependency detected "${dependency}":${context.packageJson.dependencies[dependency]}". Please fix at package.json.`
// [0055] malformed dependency detected "${dependency}":${context.packageJson.devDependencies[dependency]}". Please fix at package.json.`
// [0056] Wildcard dependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
// [0057] Wildcard devDependencies should be avoided "${dependency}":"${dependencyVersion}". Use "~1.2.3" or "^1.2.3" syntax at package.json.`,
// [0058] Key ${objectName} at package.json is not supported. Please remove.
// [0059] No "scripts" key found in the package.json.
// [0060] ${dependency} listed as dependency and as devDependency.
// [0061] Invalid version format "${context.packageJson.version}". Version must follow semver format: MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-PRERELEASE.NUMBER (e.g., "1.2.3" or "1.2.3-alpha.4"). No leading zeros allowed, prerelease identifiers must contain only letters, numbers, and hyphens.
// [0062] No devDependency declared for ${dependency}. Please consider adding "${dependency}":"${recommendedVersion}" to devDependencies at package.json`
// [0063] "${pkg}" is already included in "@iobroker/testing" >= 5.1.1. Please remove from devDependencies at package.json
// [0064] ${dependency} ${dependencyVersion} specified. Newer version ${actualVersion} exists.

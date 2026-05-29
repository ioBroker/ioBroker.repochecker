'use strict';

/*
    This module is a support module for iobroker.repochecker

    Area checked:   package.json
    Numbering   :   0001 - 0099

*/

const compareVersions = require('compare-versions');
const semver = require('semver');
const axios = require('axios');

const common = require('./common.js');

/* TODO: configuration should be moved to context */

// node.js versions required and recommended
// Note: node version specify rules for engines clause and do NOT reflect the recommended node version for users
const specialAdapters = ['admin', 'backitup', 'javascript', 'js-controller'];
let recommendedNodeVersion = '22'; // This is the minimum node version that should be required at engines clause
let requiredNodeVersion = '20'; // This is the minimum node version that must be required at engines clause
const minimumNodeVersion = '18'; // This is the minimum node version that must be required ba all adapters at engines clause

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
        required: '5.2.0',
        recommended: '5.2.0',
        actual: '5.2.0',
        optional: true,
        suggested: true,
        // Conditional requirements: when this package is >= a certain version,
        // other packages have updated requirements
        conditionalRequirements: [
            // { see >>> S5026 <<<
            //     ifVersion: '0.0.0',
            //     targetDependency: '@alcalzone/release-script-plugin-iobroker',
            //     suggested: true,
            // },
            {
                ifVersion: '5.2.0',
                targetDependency: '@alcalzone/release-script-plugin-iobroker',
                required: '5.2.0',
            },
            // {
            //     ifVersion: '0.0.0',
            //     targetDependency: '@alcalzone/release-script-plugin-license',
            //     suggested: true,
            // },
            {
                ifVersion: '5.2.0',
                targetDependency: '@alcalzone/release-script-plugin-license',
                required: '5.2.0',
            },
            // {
            //     ifVersion: '0.0.0',
            //     targetDependency: '@alcalzone/release-script-plugin-manual-review',
            //     suggested: true,
            // },
            {
                ifVersion: '5.2.0',
                targetDependency: '@alcalzone/release-script-plugin-manual-review',
                required: '5.2.0',
            },
        ],
    },
    '@alcalzone/release-script-plugin-iobroker': {
        required: '5.2.0',
        recommended: '5.2.0',
        actual: '5.2.0',
        optional: true,
        suggested: false,
    },
    '@alcalzone/release-script-plugin-license': {
        required: '5.2.0',
        recommended: '5.2.0',
        actual: '5.2.0',
        optional: true,
        suggested: false,
    },
    '@alcalzone/release-script-plugin-manual-review': {
        required: '5.2.0',
        recommended: '5.2.0',
        actual: '5.2.0',
        optional: true,
        suggested: false,
    },
    '@iobroker/adapter-dev': {
        required: '1.3.0',
        recommended: '1.5.0',
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
        required: '5.2.2',
        recommended: '5.2.2',
        actual: '5.2.2',
        onlyWWW: false,
        alternatives: ['@iobroker/legacy-testing'],
    },
};

// packages which must NOT be listed as dependencies in any context
const blacklistedAllDependenciesPackageJson = {
    admin: {
        msg: "'admin'must not be listed as any dependency at package.json. Please remove and create new release.",
        err: true,
    },
    iobroker: {
        msg: "'iobroker'must not be listed as any dependency at package.json. Please remove and create new release.",
        err: true,
    },
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
        exceptions: ['javascript'],
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
        msg: "'dependency @iobroker/adapter-core' seems to be obsolete as 'common.onlyWWW' is set to true.",
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
 * Applies conditional requirements based on dependencies present in package.json.
 * When a source dependency is at a certain version or higher, it updates the
 * required/recommended versions of target dependencies.
 *
 * @param {object} dependencyTable - The dependency requirements table (dependenciesPackageJson or devDependenciesPackageJson)
 * @param {object} packageJsonDeps - The dependencies from package.json being checked
 */
function applyConditionalRequirements(dependencyTable, packageJsonDeps) {
    if (!packageJsonDeps) {
        return;
    }

    for (const sourceDep in dependencyTable) {
        const config = dependencyTable[sourceDep];
        if (!config.conditionalRequirements || !Array.isArray(config.conditionalRequirements)) {
            continue;
        }

        // Check if the source dependency is present in package.json
        let sourceVersion = packageJsonDeps[sourceDep];
        if (!sourceVersion) {
            continue;
        }

        // Remove ^ or ~ prefix to get the version number
        sourceVersion = sourceVersion.replace(/[\^~]/g, '').trim();

        // Process each conditional requirement
        for (const condition of config.conditionalRequirements) {
            const { ifVersion, targetDependency, required, recommended, suggested } = condition;

            // Check if the source dependency version meets the condition
            try {
                if (compareVersions.compare(sourceVersion, ifVersion, '>=')) {
                    // Apply the conditional requirements to the target dependency
                    if (dependencyTable[targetDependency]) {
                        if (required) {
                            // Use the higher version between existing and conditional required
                            const existingRequired = dependencyTable[targetDependency].required;
                            if (existingRequired && compareVersions.compare(required, existingRequired, '>')) {
                                dependencyTable[targetDependency].required = required;
                                common.debug(
                                    `Conditional requirement: ${targetDependency} required updated to ${required} due to ${sourceDep} >= ${ifVersion}`,
                                );
                            } else if (!existingRequired) {
                                dependencyTable[targetDependency].required = required;
                                common.debug(
                                    `Conditional requirement: ${targetDependency} required set to ${required} due to ${sourceDep} >= ${ifVersion}`,
                                );
                            }
                        }
                        if (recommended) {
                            // Use the higher version between existing and conditional recommended
                            const existingRecommended = dependencyTable[targetDependency].recommended;
                            if (existingRecommended && compareVersions.compare(recommended, existingRecommended, '>')) {
                                dependencyTable[targetDependency].recommended = recommended;
                                common.debug(
                                    `Conditional requirement: ${targetDependency} recommended updated to ${recommended} due to ${sourceDep} >= ${ifVersion}`,
                                );
                            } else if (!existingRecommended) {
                                dependencyTable[targetDependency].recommended = recommended;
                                common.debug(
                                    `Conditional requirement: ${targetDependency} recommended set to ${recommended} due to ${sourceDep} >= ${ifVersion}`,
                                );
                            }
                        }
                        if (suggested) {
                            dependencyTable[targetDependency].suggested = suggested;
                            common.debug(
                                `Conditional requirement: ${targetDependency} suggested set to ${suggested} due to ${sourceDep} >= ${ifVersion}`,
                            );
                        }
                    }
                }
            } catch (e) {
                // Version comparison failed, skip this condition
                common.debug(`Could not compare versions for conditional requirement: ${e}`);
            }
        }
    }
}
function fileExistsInList(context, filePath) {
    if (!context.filesList) {
        throw new Error('FATAL: context.filesList is undefined');
    }
    return context.filesList.includes(filePath) || context.filesList.includes(filePath.replace(/^\//, ''));
}

/**
 * Expands npm alias dependencies into separate entries for both the alias name and the real package name.
 * An npm alias has the format: "alias-name": "npm:real-package@version"
 * The expanded result contains one entry for "alias-name" and one for "real-package", both using the extracted version.
 * Non-alias entries are kept as-is.
 *
 * @param {object} dependencies - The dependencies object from package.json
 * @returns {object} Expanded dependencies object with alias entries split into two entries
 */
function expandNpmAliases(dependencies) {
    if (!dependencies) {
        return {};
    }
    const expanded = {};
    for (const [name, version] of Object.entries(dependencies)) {
        if (typeof version === 'string' && version.startsWith('npm:')) {
            const withoutPrefix = version.slice(4); // Remove "npm:" prefix
            const lastAt = withoutPrefix.lastIndexOf('@');
            if (lastAt > 0) {
                const realPackage = withoutPrefix.slice(0, lastAt);
                const realVersion = withoutPrefix.slice(lastAt + 1);
                expanded[name] = realVersion;
                expanded[realPackage] = realVersion;
            } else {
                expanded[name] = version;
            }
        } else {
            expanded[name] = version;
        }
    }
    return expanded;
}

/**
 * Parses a dependency declaration and resolves npm aliases.
 *
 * @param {string} packageName - Declared package name in package.json
 * @param {string} packageVersion - Declared package version/range in package.json
 * @returns {{ packageName: string; packageVersion: string }} Parsed package name and version
 */
function parseDependencyDeclaration(packageName, packageVersion) {
    common.debug(`executing parseDependencyDeclaration(${packageName}, ${packageVersion})`);

    if (typeof packageVersion !== 'string' || !packageVersion.startsWith('npm:')) {
        return { packageName, packageVersion };
    }

    const withoutPrefix = packageVersion.slice(4);
    const lastAt = withoutPrefix.lastIndexOf('@');
    if (lastAt <= 0) {
        return { packageName, packageVersion };
    }

    return {
        packageName: withoutPrefix.slice(0, lastAt),
        packageVersion: withoutPrefix.slice(lastAt + 1),
    };
}

/**
 * Returns the update-check rule for the provided package.
 *
 * @param {object} context - The checker context
 * @param {string} packageName - npm package name
 * @returns {{ minimumAgeDays: number; level: 'S' | 'W' }} Threshold and severity for update suggestions
 */
function getNpmUpdateRule(context, packageName) {
    const rules = context.cfg?.npmUpdateSuggestions || {};
    const defaultMinimumAgeDays = Number.isFinite(rules.defaultMinimumAgeDays) ? rules.defaultMinimumAgeDays : 60;
    const newAdapterMinimumAgeDays = Number.isFinite(rules.newAdapterMinimumAgeDays)
        ? rules.newAdapterMinimumAgeDays
        : 7;

    const defaultLevel = context.cfg?.isNewAdapter ? 'W' : 'S';
    let minimumAgeDays = context.cfg?.isNewAdapter ? newAdapterMinimumAgeDays : defaultMinimumAgeDays;
    let level = defaultLevel;

    for (const entry of rules.standardPackages || []) {
        if (!entry || entry.name !== packageName) {
            continue;
        }
        if (Number.isFinite(entry.minimumAgeDays)) {
            minimumAgeDays = entry.minimumAgeDays;
        }
        if (entry.level === 'S' || entry.level === 'W') {
            level = entry.level;
        }
        break;
    }

    return { minimumAgeDays, level };
}

/**
 * Checks if dependencies/devDependencies should receive update suggestions based on npm publish age.
 *
 * @param {object} context - The checker context
 * @returns {Promise<object>} Updated context with dependency update suggestions
 */
async function checkNpmDependencyUpdateSuggestions(context) {
    common.debug(`executing checkNpmDependencyUpdateSuggestions`);
    const dependencySources = [
        ['dependencies', context.packageJson.dependencies || {}],
        ['devDependencies', context.packageJson.devDependencies || {}],
    ];
    const deduplicatedChecks = new Map();

    for (const [sourceType, sourceDeps] of dependencySources) {
        for (const [declaredName, declaredVersion] of Object.entries(sourceDeps)) {
            const parsed = parseDependencyDeclaration(declaredName, declaredVersion);
            common.debug(`    result: {${parsed.packageName}, ${parsed.packageVersion}}`);
            if (!semver.validRange(parsed.packageVersion)) {
                common.debug(`    ${parsed.packageVersion} is invalid, ignored`);
                continue;
            }

            const minVersion = semver.minVersion(parsed.packageVersion);
            if (!minVersion) {
                continue;
            }

            const key = `${parsed.packageName}:${minVersion.version}`;
            if (!deduplicatedChecks.has(key)) {
                deduplicatedChecks.set(key, {
                    packageName: parsed.packageName,
                    packageVersion: minVersion.version,
                    sourceType,
                });
            }
        }
    }

    common.debug(`    deduplictedChecks prepared`);

    const now = Date.now();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    const checks = Array.from(deduplicatedChecks.values());
    const batchSize = 5;
    for (let i = 0; i < checks.length; i += batchSize) {
        const batch = checks.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async checkItem => {
                const { packageName, packageVersion, sourceType } = checkItem;
                if (context.cfg?.npmUpdateSuggestions?.blacklistedPackages.includes(packageName)) {
                    return;
                }
                try {
                    common.debug(`   fetching npm data for ${packageName}`);
                    const response = await axios(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
                    const npmData = response.data;
                    const latestVersion = npmData?.['dist-tags']?.latest;
                    const latestPublishedAt = npmData?.time?.[latestVersion];

                    if (!latestVersion || compareVersions.compare(latestVersion, packageVersion, '<=')) {
                        return;
                    }
                    if (!latestPublishedAt) {
                        return;
                    }

                    const publishedAtDate = new Date(latestPublishedAt);
                    if (Number.isNaN(publishedAtDate.getTime())) {
                        return;
                    }

                    const packageAgeDays = Math.floor((now - publishedAtDate.getTime()) / millisecondsPerDay);
                    const updateRule = getNpmUpdateRule(context, packageName);
                    if (packageAgeDays < updateRule.minimumAgeDays) {
                        return;
                    }

                    const dayLabel = packageAgeDays === 1 ? 'day' : 'days';
                    const issueCode = updateRule.level === 'W' ? 'W0083' : 'S0082';
                    context.warnings.push(
                        `[${issueCode}] Package "${packageName}" (${sourceType}) can be updated from ${packageVersion} to ${latestVersion}. The newer version has been published for ${packageAgeDays} ${dayLabel}. Please evaluate updating package.json.`,
                    );
                } catch (e) {
                    common.debug(
                        `Could not fetch npm registry data for "${packageName}" while checking dependency update suggestions: ${e.message || e}`,
                    );
                }
            }),
        );
    }

    return context;
}

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

    // adapt some limits for special adapters
    if (specialAdapters.includes(context.adapterName)) {
        if (requiredNodeVersion !== minimumNodeVersion) {
            context.warnings.push(
                `[S0000] Info: required node.js requirement ${requiredNodeVersion} reduced to ${minimumNodeVersion} for this adapter`,
            );
            requiredNodeVersion = minimumNodeVersion;
        }
        if (recommendedNodeVersion !== minimumNodeVersion) {
            context.warnings.push(
                `[S0000] Info: recommended node.js requirement ${recommendedNodeVersion} reduced to ${minimumNodeVersion} for this adapter`,
            );
            recommendedNodeVersion = minimumNodeVersion;
        }
    }

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
    if (!context.packageJson.scripts || !context.packageJson.scripts.lint) {
        context.warnings.push('[W0074] No "lint" script found in package.json. Please add one.');
    } else {
        context.checks.push('"lint" script found in package.json');
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

            if (
                blacklistedDependenciesPackageJson[blacklist].exceptions &&
                blacklistedDependenciesPackageJson[blacklist].exceptions.includes(adapterName)
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

            if (
                blacklistedDevDependenciesPackageJson[blacklist].exceptions &&
                blacklistedDevDependenciesPackageJson[blacklist].exceptions.includes(adapterName)
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

            if (
                blacklistedPeerDependenciesPackageJson[blacklist].exceptions &&
                blacklistedPeerDependenciesPackageJson[blacklist].exceptions.includes(adapterName)
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

            if (
                blacklistedOptionalDependenciesPackageJson[blacklist].exceptions &&
                blacklistedOptionalDependenciesPackageJson[blacklist].exceptions.includes(adapterName)
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
    let minimumNodeJsSupported = null;
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
                const nodeVal = context.packageJson.engines.node;
                minimumNodeJsSupported = common.getMinimumNodeJsVersion(nodeVal);
                if (!minimumNodeJsSupported) {
                    context.warnings.push(
                        `[W0027] Engines clause at package.json ({'engines' : { 'node' : '${nodeVal}' } }") is not parseable.`,
                    );
                } else {
                    common.debug(`minimum node.js version from engines clause: ${minimumNodeJsSupported}`);
                    if (!String(nodeVal).trim().match(/^>=?/)) {
                        context.warnings.push(
                            `[W0028] Minimum node.js version ${recommendedNodeVersion} recommended. Please change "{'engines' : { 'node' : '${nodeVal}' } }" to "{'engines' : { 'node' : '>=${recommendedNodeVersion}' } }" at package.json.`,
                        );
                    } else {
                        if (!compareVersions.compare(minimumNodeJsSupported, requiredNodeVersion, '>=')) {
                            context.errors.push(
                                `[E0029] Node.js ${requiredNodeVersion} is required as minimum, node.js ${recommendedNodeVersion} is recommended. Please change "{'engines' : { 'node' : '${nodeVal}' } }" to "{'engines' : { 'node' : '>=${requiredNodeVersion}' } }" at package.json.`,
                            );
                        } else if (!compareVersions.compare(minimumNodeJsSupported, recommendedNodeVersion, '>=')) {
                            context.warnings.push(
                                `[W0028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' : '${nodeVal}' } }" to "{'engines' : { 'node' : '>=${recommendedNodeVersion}' } }" at package.json.`,
                            );
                        } else {
                            context.checks.push(
                                `Correct node.js version ${minimumNodeJsSupported} requested by "engines" attribute at package.json.`,
                            );
                        }
                    }
                }
            }
        }
    } else {
        context.checks.push('"engines" check skipped for wwwOnly adapter.');
    }

    // Default to Node.js 20 if no engines clause was found for non-WWW adapters
    if (minimumNodeJsSupported === null && !context.cfg.onlyWWW) {
        minimumNodeJsSupported = '20';
    }

    // Apply conditional requirements based on dependencies present in package.json
    // This must be done before checking dependencies so that version requirements are updated
    if (context.packageJson.dependencies) {
        applyConditionalRequirements(dependenciesPackageJson, context.packageJson.dependencies);
    }
    if (context.packageJson.devDependencies) {
        applyConditionalRequirements(devDependenciesPackageJson, context.packageJson.devDependencies);
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
        const exists = !!(context.packageJson.dependencies && context.packageJson.dependencies[`${dependency}`]);
        let dependencyVersion =
            (context.packageJson.dependencies && context.packageJson.dependencies[`${dependency}`]) || '';
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
                if (context.packageJson.dependencies && context.packageJson.dependencies[`${alternative}`]) {
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
        const exists = !!(context.packageJson.devDependencies && context.packageJson.devDependencies[`${dependency}`]);
        let dependencyVersion =
            (context.packageJson.devDependencies && context.packageJson.devDependencies[`${dependency}`]) || '';
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
                if (context.packageJson.devDependencies && context.packageJson.devDependencies[`${alternative}`]) {
                    found = alternative;
                }
            }
            if (found) {
                context.checks.push(`devDependency ${dependency} satisfied by ${found}`);
            } else if (optional) {
                context.checks.push(`devDependency ${dependency} is optional`);
                if (suggested) {
                    context.warnings.push(`[S0062] Consider adding and using package "${dependency}".`);
                }
            } else {
                context.errors.push(
                    `[E0035] No devDependency declared for ${dependency}. Please add "${dependency}":"${actualVersion}" to devDependencies at package.json`,
                );
            }
        }
    }
    context.checks.push('required devDependencies have been checked.');

    await checkNpmDependencyUpdateSuggestions(context);

    // Check eslint migration and config requirements
    const devDeps = context.packageJson.devDependencies || {};
    const hasEslintConfig = Object.prototype.hasOwnProperty.call(devDeps, '@iobroker/eslint-config');
    if (!hasEslintConfig) {
        context.warnings.push(
            '[S0071] No devDependency for "@iobroker/eslint-config" found. Consider migrating to the shared ESLint config.',
        );
    }

    const eslintVersionRaw = devDeps.eslint;
    const eslintVersion = eslintVersionRaw ? semver.coerce(eslintVersionRaw) : null;
    const hasEslintV9OrHigher = !!(eslintVersion && semver.gte(eslintVersion, '9.0.0'));
    if (eslintVersion && semver.lt(eslintVersion, '9.0.0')) {
        context.warnings.push(
            `[W0072] "eslint":"${eslintVersionRaw}" is outdated. Please migrate to "@iobroker/eslint-config".`,
        );
    } else if (hasEslintV9OrHigher && !hasEslintConfig) {
        context.warnings.push(
            `[S0073] "eslint":"${eslintVersionRaw}" is >= 9.0.0 but "@iobroker/eslint-config" is not used. Consider migrating to "@iobroker/eslint-config".`,
        );
    }

    if (hasEslintConfig) {
        const obsoleteEslintDevDeps = [
            '@eslint/eslintrc',
            '@eslint/js',
            '@typescript-eslint/eslint-plugin',
            '@typescript-eslint/parser',
            'eslint',
            'eslint-config-prettier',
            'eslint-plugin-import',
            'eslint-plugin-jsdoc',
            'eslint-plugin-prettier',
            'eslint-plugin-react',
            'eslint-plugin-react-hooks',
            'eslint-plugin-unicorn',
            'prettier',
            'typescript-eslint',
        ];
        const foundObsoleteDeps = obsoleteEslintDevDeps.filter(dep =>
            Object.prototype.hasOwnProperty.call(devDeps, dep),
        );
        if (foundObsoleteDeps.length > 0) {
            context.warnings.push(
                `[W0078] Remove obsolete devDependencies ${foundObsoleteDeps.join(', ')} when using "@iobroker/eslint-config".`,
            );
        }
    }

    // check @types/node version vs engines.node minimum version
    if (minimumNodeJsSupported !== null) {
        const minMajor = parseInt(minimumNodeJsSupported.split('.')[0], 10);
        context.checks.push(
            `Minimum supported Node.js version from engines clause is ${minimumNodeJsSupported} (major: ${minMajor}).`,
        );

        const typesNodeDevVersion =
            context.packageJson.devDependencies && context.packageJson.devDependencies['@types/node'];

        if (!typesNodeDevVersion) {
            context.warnings.push(
                `[S0065] No devDependency for "@types/node" found. Consider adding "@types/node":">=${minMajor}" to devDependencies at package.json.`,
            );
        }

        // Check @types/node across all dependency types
        const typesNodeVersion =
            typesNodeDevVersion ||
            (context.packageJson.dependencies && context.packageJson.dependencies['@types/node']) ||
            (context.packageJson.optionalDependencies && context.packageJson.optionalDependencies['@types/node']);

        if (typesNodeVersion) {
            try {
                if (!semver.validRange(typesNodeVersion)) {
                    context.errors.push(
                        `[E0068] Invalid semver format ${typesNodeVersion} for "@types/node" at package.json.`,
                    );
                } else {
                    // Check if @types/node allows a higher major version than the minimum
                    if (semver.intersects(typesNodeVersion, `>=${minMajor + 1}.0.0`)) {
                        context.warnings.push(
                            `[W0066] "@types/node":"${typesNodeVersion}" at package.json allows major version greater than ${minMajor}. Downgrade to node.js ${minMajor}.x.x to avoid wrong typing is recommended.`,
                        );
                        // } else if (!semver.satisfies(`${minMajor}.0.0`, typesNodeVersion)) {
                        //     // Check if @types/node does not cover the minimum node version
                        //     context.warnings.push(
                        //         `[S0067] "@types/node":"${typesNodeVersion}" at package.json does not cover minimum node.js version ${minimumNodeJsSupported}. Consider updating to "@types/node":"^${minMajor}" to match the engines clause.`,
                        //     );
                    } else {
                        context.checks.push(
                            `@types/node "${typesNodeVersion}" matches minimum node.js version ${minimumNodeJsSupported}.`,
                        );
                    }
                }
            } catch (e) {
                common.debug(`Could not check @types/node version "${typesNodeVersion}": ${e}`);
            }
        }

        const tsConfigNodeDependencyPattern = /^@tsconfig\/node(?<major>\d{2})$/;
        const tsConfigNodeDevDependencyName = Object.keys(context.packageJson.devDependencies || {}).find(dep =>
            tsConfigNodeDependencyPattern.test(dep),
        );
        let tsConfigNodeDevDependencyNameNew = tsConfigNodeDevDependencyName;

        let shouldAdjustTsConfig = false;
        if (!tsConfigNodeDevDependencyName) {
            context.warnings.push(
                '[S0085] No devDependency "@tsconfig/nodeXX" found. Consider adding one for proper type checking (see ioBroker.examples for examples).',
            );
        } else {
            const tsConfigNodeDevDependencyMatch = tsConfigNodeDevDependencyName.match(tsConfigNodeDependencyPattern);
            const tsConfigNodeDevDependencyMajor = parseInt(tsConfigNodeDevDependencyMatch.groups.major, 10);
            if (tsConfigNodeDevDependencyMajor !== minMajor) {
                shouldAdjustTsConfig = true;
                tsConfigNodeDevDependencyNameNew = `@tsconfig/node${minMajor}`
                context.warnings.push(
                    `[W0086] "${tsConfigNodeDevDependencyName}" should match the major node.js version from package.json engines.node (>=${minMajor}). Please update to ${tsConfigNodeDevDependencyNameNew} at package.json.`,
                );
            }
        }

        if (!fileExistsInList(context, '/tsconfig.json')) {
            context.warnings.push(
                '[S0087] Missing "/tsconfig.json". Consider adding it for proper type checking (see ioBroker.examples for examples).',
            );
        } else {
            try {
                const tsConfigContent = String((await common.getFile(context, '/tsconfig.json')) || '');
                const extendsMatch = tsConfigContent.match(/"extends"\s*:\s*"(?<extendsPath>[^"]+)"/);

                if (!extendsMatch || !extendsMatch.groups.extendsPath) {
                    context.warnings.push(
                        '[S0088] "/tsconfig.json" should contain an extends clause like "extends": "@tsconfig/node20/tsconfig.json" (see ioBroker.examples).',
                    );
                } else {
                    const extendsPath = extendsMatch.groups.extendsPath;
                    const extendsTsConfigNodeMatch = extendsPath.match(/^@tsconfig\/node(?<major>\d{2})\//);
                    if (!extendsTsConfigNodeMatch) {
                        context.warnings.push(
                            '[S0088] "/tsconfig.json" should use an extends clause like "extends": "@tsconfig/node20/tsconfig.json" (see ioBroker.examples).',
                        );
                    } else {
                        const extendsDependencyName = `@tsconfig/node${extendsTsConfigNodeMatch.groups.major}`;
                        if (tsConfigNodeDevDependencyName && extendsDependencyName !== tsConfigNodeDevDependencyName) {
                            shouldAdjustTsConfig = true;
                            context.warnings.push(
                                `[W0089] "/tsconfig.json" extends "${extendsPath}" but package.json uses "${tsConfigNodeDevDependencyName}". Please update/downgrade the devDependency to match the extends package.`,
                            );
                        }
                        if (shouldAdjustTsConfig) {
                            context.warnings.push(
                                `[W0090] "/tsconfig.json" should be adjusted to match "${tsConfigNodeDevDependencyNameNew}" (for example: "extends": "${tsConfigNodeDevDependencyNameNew}/tsconfig.json").`,
                            );
                        }
                    }
                }
            } catch (e) {
                context.errors.push(`[E0091] Could not read "/tsconfig.json": ${e.message || e}`);
            }
        }
    }

    // Check for unneeded devDependencies when @iobroker/testing >= 5.1.1 is installed
    if (context.packageJson.devDependencies && context.packageJson.devDependencies['@iobroker/testing']) {
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
    const expandedDependencies = expandNpmAliases(context.packageJson.dependencies || {});
    let forcedDependencyFlag = false;
    for (const dependency in expandedDependencies) {
        const dependencyVersion = expandedDependencies[dependency];
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
            !dependencyVersion.startsWith('^') &&
            !dependencyVersion.startsWith('~') &&
            !dependencyVersion.startsWith('>') &&
            !dependencyVersion.startsWith('<')
        ) {
            if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E0044] dependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${dependencyVersion}"`,
                );
            } else {
                forcedDependencyFlag = true;
                // context.warnings.push(
                //     `[S0047] dependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${dependencyVersion}"`,
                // );
            }
        }
    }
    if (forcedDependencyFlag) {
        context.warnings.push(
            `[S0047] At least one dependency at package.json requires a specific version. Consider using "~1.2.3" or "^1.2.3" syntax unless freezing dependencies is really desired.`,
        );
    }

    const expandedDevDependencies = expandNpmAliases(context.packageJson.devDependencies || {});
    let forcedDevDependencyFlag = false;
    for (const dependency in expandedDevDependencies) {
        const dependencyVersion = expandedDevDependencies[dependency];
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
            !dependencyVersion.startsWith('^') &&
            !dependencyVersion.startsWith('~') &&
            !dependencyVersion.startsWith('>') &&
            !dependencyVersion.startsWith('<')
        ) {
            if (enforcedDependencies.includes(dependency)) {
                context.errors.push(
                    `[E0046] devDependency must not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${dependencyVersion}"`,
                );
            } else {
                forcedDevDependencyFlag = true;
                // context.warnings.push(
                //     `[W0048] devDependency should not require a specific version. Use "~1.2.3" or "^1.2.3" syntax. Please update "${dependency}:${dependencyVersion}"`,
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
    // first free 069

    // Store the minimum node.js version in context for use by subsequent checks
    context.minimumNodeJsSupported = minimumNodeJsSupported;

    return context;
}

async function checkEslintFileChecks(context) {
    const devDeps = context.packageJson.devDependencies || {};
    const hasEslintConfig = Object.prototype.hasOwnProperty.call(devDeps, '@iobroker/eslint-config');
    const eslintVersionRaw = devDeps.eslint;
    const eslintVersion = eslintVersionRaw ? semver.coerce(eslintVersionRaw) : null;
    const hasEslintV9OrHigher = !!(eslintVersion && semver.gte(eslintVersion, '9.0.0'));
    const obsoleteEslintFiles = ['/.eslintignore', '/.eslintrc.json'];
    const obsoletePrettierFiles = ['/.prettierignore', '/.prettierrc.js'];

    if (hasEslintConfig) {
        if (!fileExistsInList(context, '/eslint.config.mjs')) {
            context.errors.push(
                '[E0075] "eslint.config.mjs" is missing although "@iobroker/eslint-config" is configured.',
            );
        } else {
            try {
                const eslintConfigContent = await common.getFile(context, '/eslint.config.mjs');
                const hasImport = /import\s+config\s+from\s+['"]@iobroker\/eslint-config['"]\s*;?/.test(
                    String(eslintConfigContent || ''),
                );
                if (!hasImport) {
                    context.errors.push(
                        '[E0077] "eslint.config.mjs" should use installed "@iobroker/eslint-config" via `import config from \'@iobroker/eslint-config\';`.',
                    );
                } else {
                    context.checks.push('"eslint.config.mjs" imports "@iobroker/eslint-config".');
                }
            } catch (e) {
                context.errors.push(`[E0081] Could not read "eslint.config.mjs": ${e.message || e}`);
            }
        }

        if (!fileExistsInList(context, '/prettier.config.mjs')) {
            context.warnings.push(
                '[W0076] "prettier.config.mjs" is missing although "@iobroker/eslint-config" is configured.',
            );
        } else {
            context.checks.push('"prettier.config.mjs" found.');
        }

        if (fileExistsInList(context, '/eslint.config.mjs')) {
            const foundObsoleteFiles = obsoleteEslintFiles.filter(file => fileExistsInList(context, file));
            if (foundObsoleteFiles.length > 0) {
                context.warnings.push(
                    `[W0079] Remove obsolete eslint config files when using "/eslint.config.mjs": ${foundObsoleteFiles.map(file => file.slice(1)).join(', ')}.`,
                );
            }
        }
        if (fileExistsInList(context, '/prettier.config.mjs')) {
            const foundObsoleteFiles = obsoletePrettierFiles.filter(file => fileExistsInList(context, file));
            if (foundObsoleteFiles.length > 0) {
                context.warnings.push(
                    `[W0084] Remove obsolete prettier config files when using "/prettier.config.mjs": ${foundObsoleteFiles.map(file => file.slice(1)).join(', ')}.`,
                );
            }
        }
    } else if (hasEslintV9OrHigher) {
        const foundObsoleteFiles = obsoleteEslintFiles.filter(file => fileExistsInList(context, file));
        if (foundObsoleteFiles.length > 0) {
            context.warnings.push(
                `[S0080] Remove obsolete eslint/prettier config files: ${foundObsoleteFiles.map(file => file.slice(1)).join(', ')}.`,
            );
        }
    }

    return context;
}

/**
 * Creates a package-lock.json in a temp directory by running npm install --package-lock-only.
 * Returns the content of the generated package-lock.json, or throws if creation fails.
 *
 * @param {object} context - The checker context
 * @returns {Promise<string>} The content of the generated package-lock.json
 */
async function createPackageLockJson(context) {
    const { exec } = require('node:child_process');
    const os = require('node:os');
    const path = require('node:path');
    const fsp = require('node:fs/promises');

    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'repochecker-'));
    common.debug(`Created temp dir ${tmpDir} for package-lock.json generation`);
    try {
        await fsp.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(context.packageJson, null, 2));

        await new Promise((resolve, reject) => {
            exec('npm install --package-lock-only --ignore-scripts', { cwd: tmpDir, timeout: 120000 }, error => {
                if (error) {
                    reject(new Error(`npm install --package-lock-only failed: ${error.message}`));
                } else {
                    resolve();
                }
            });
        });

        const lockContent = await fsp.readFile(path.join(tmpDir, 'package-lock.json'), 'utf8');
        return lockContent;
    } finally {
        try {
            await fsp.rm(tmpDir, { recursive: true, force: true });
        } catch (e) {
            common.debug(`Could not clean up temp dir ${tmpDir}: ${e}`);
        }
    }
}

/**
 * Checks if dependencies listed in package-lock.json require a Node.js version
 * that is incompatible with the adapter's engines.node constraint.
 * If no package-lock.json is present, attempts to create one via npm install --package-lock-only.
 *
 * @param {object} context - The checker context
 * @returns {Promise<object>} The updated context
 */
async function checkDependencyNodeRequirements(context) {
    const minimumNodeJsSupported = context.minimumNodeJsSupported;

    if (!minimumNodeJsSupported) {
        context.checks.push('Dependency node requirements check skipped (no engines.node clause in adapter).');
        return context;
    }

    let packageLockContent = null;
    const hasPackageLock = fileExistsInList(context, '/package-lock.json');

    if (hasPackageLock) {
        // Load package-lock.json from the repository
        try {
            const lockFileContent = await common.getFile(context, '/package-lock.json');
            if (lockFileContent) {
                packageLockContent =
                    typeof lockFileContent === 'object' ? JSON.stringify(lockFileContent) : lockFileContent;
            }
        } catch (e) {
            common.debug(`Could not load package-lock.json: ${e}`);
        }
    } else {
        // package-lock.json not in repo - try to create it temporarily
        context.checks.push(
            'package-lock.json not found in repository, attempting to create it for dependency check...',
        );
        try {
            packageLockContent = await createPackageLockJson(context);
            context.checks.push('package-lock.json created successfully for dependency check.');
        } catch (e) {
            common.debug(`Could not create package-lock.json: ${e}`);
            context.warnings.push(
                '[S0070] Dependency node requirement check could not be performed: package-lock.json is not available and could not be created. Consider adding package-lock.json to the repository.',
            );
            return context;
        }
    }

    if (!packageLockContent) {
        context.warnings.push(
            '[S0070] Dependency node requirement check could not be performed: package-lock.json could not be loaded.',
        );
        return context;
    }

    let lockJson;
    try {
        lockJson = JSON.parse(packageLockContent);
    } catch {
        context.warnings.push(
            '[S0070] Dependency node requirement check could not be performed: package-lock.json is not valid JSON.',
        );
        return context;
    }

    // Only lockfileVersion 2+ includes engines data in the packages field
    if (!lockJson.packages || lockJson.lockfileVersion < 2) {
        context.checks.push(
            'Dependency node requirements check skipped (package-lock.json lockfileVersion < 2, no engines data available).',
        );
        return context;
    }

    const adapterMinVersion = semver.coerce(minimumNodeJsSupported);
    if (!adapterMinVersion) {
        context.checks.push(
            `Dependency node requirements check skipped (cannot parse adapter minimum node version: ${minimumNodeJsSupported}).`,
        );
        return context;
    }

    const rootDependencies = Object.keys(context.packageJson.dependencies || {});
    if (rootDependencies.length === 0) {
        context.checks.push('Dependency node requirements check skipped (no runtime dependencies declared).');
        return context;
    }

    const resolvePackagePath = (packageName, fromPath, packages) => {
        let currentPath = fromPath;
        while (true) {
            const candidate = currentPath
                ? `${currentPath}/node_modules/${packageName}`
                : `node_modules/${packageName}`;
            if (packages[candidate]) {
                return candidate;
            }
            const parentIndex = currentPath.lastIndexOf('/node_modules/');
            if (parentIndex === -1) {
                break;
            }
            currentPath = currentPath.slice(0, parentIndex);
        }
        return packages[`node_modules/${packageName}`] ? `node_modules/${packageName}` : null;
    };

    const getRelevantPackagePaths = (packages, runtimeDependencies) => {
        const relevantPaths = new Set();
        const stack = [];
        const resolutionCache = new Map();

        for (const dependencyName of runtimeDependencies) {
            const dependencyPath = resolvePackagePath(dependencyName, '', packages);
            dependencyPath && stack.push(dependencyPath);
        }

        while (stack.length > 0) {
            const currentPath = stack.pop();
            if (!currentPath || relevantPaths.has(currentPath)) {
                continue;
            }

            relevantPaths.add(currentPath);
            const currentPackage = packages[currentPath];
            if (!currentPackage) {
                continue;
            }

            const childDependencies = new Set(Object.keys(currentPackage.dependencies || {}));

            for (const childName of childDependencies) {
                const cacheKey = `${currentPath}::${childName}`;
                let childPath = resolutionCache.get(cacheKey);
                if (childPath === undefined) {
                    childPath = resolvePackagePath(childName, currentPath, packages);
                    resolutionCache.set(cacheKey, childPath);
                }
                childPath && stack.push(childPath);
            }
        }

        return relevantPaths;
    };

    const relevantPackagePaths = getRelevantPackagePaths(lockJson.packages, rootDependencies);
    const incompatiblePackages = [];

    for (const [pkgPath, pkgData] of Object.entries(lockJson.packages)) {
        // Skip root package entry and entries without engines.node
        if (!pkgPath || pkgPath === '' || !pkgData || !pkgData.engines || !pkgData.engines.node) {
            continue;
        }
        if (!relevantPackagePaths.has(pkgPath)) {
            continue;
        }

        // Extract a readable package name from the path
        // e.g. "node_modules/foo" -> "foo", "node_modules/foo/node_modules/bar" -> "foo > bar"
        const pkgName = pkgPath.replace(/^node_modules\//, '').replace(/\/node_modules\//g, ' > ');
        const nodeReq = pkgData.engines.node;

        try {
            if (!semver.satisfies(adapterMinVersion.version, nodeReq)) {
                incompatiblePackages.push(`${pkgName} (requires node: "${nodeReq}")`);
            }
        } catch (e) {
            common.debug(`Could not check node requirement "${nodeReq}" for package "${pkgName}": ${e}`);
        }
    }

    if (incompatiblePackages.length > 0) {
        const maxDisplay = 10;
        let pkgList = incompatiblePackages.slice(0, maxDisplay).join(', ');
        if (incompatiblePackages.length > maxDisplay) {
            pkgList += ` and ${incompatiblePackages.length - maxDisplay} more`;
        }
        context.warnings.push(
            `[W0069] The following dependencies require a node.js version incompatible with the adapter's minimum (node ${minimumNodeJsSupported}): ${pkgList}. Please increase the engines.node requirement at package.json or update/replace the incompatible dependencies.`,
        );
    } else {
        context.checks.push(
            `All dependency node requirements are compatible with the adapter's minimum node.js version ${minimumNodeJsSupported}.`,
        );
    }

    return context;
}

exports.getPackageJson = getPackageJson;
exports.checkPackageJson = checkPackageJson;
exports.checkEslintFileChecks = checkEslintFileChecks;
exports.checkDependencyNodeRequirements = checkDependencyNodeRequirements;
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
// [0065] No devDependency for "@types/node" found. Consider adding "@types/node":">=${minMajor}" to devDependencies at package.json.
// [0066] "@types/node":"${typesNodeVersion}" allows node.js major version ${minMajor + 1} or higher. Consider using "^${minMajor}.0.0" or ">=${minMajor} <${minMajor + 1}".
// [0067] "@types/node":"${typesNodeVersion}" does not cover minimum node.js version ${minimumNodeJsSupported}. Consider updating to ">=${minMajor}".
// [0068] Invalid semver format ${typesNodeVersion} for devDependency "@types/node" at package.json.
// [W0069] The following dependencies require a node.js version incompatible with the adapter's minimum (node ${minimumNodeJsSupported}): ...
// [S0070] Dependency node requirement check could not be performed: ...
// [S0071] No devDependency for "@iobroker/eslint-config" found.
// [W0072] "eslint" below 9.0.0 detected. Please migrate to "@iobroker/eslint-config".
// [S0073] "eslint" >= 9.0.0 detected without "@iobroker/eslint-config". Consider migrating.
// [W0074] No "lint" script found in package.json.
// [E0075] "eslint.config.mjs" is missing although "@iobroker/eslint-config" is configured.
// [W0076] "prettier.config.mjs" is missing although "@iobroker/eslint-config" is configured.
// [E0077] "eslint.config.mjs" should use installed "@iobroker/eslint-config".
// [W0078] Obsolete eslint/prettier devDependencies found while "@iobroker/eslint-config" is used.
// [W0079] Obsolete eslint/prettier config files found while "@iobroker/eslint-config" is used.
// [S0080] Obsolete eslint/prettier config files found for adapters using eslint >= 9.0.0 without "@iobroker/eslint-config".
// [E0081] Could not read "eslint.config.mjs": ${e.message || e}
// [S0082] Package "${packageName}" (${sourceType}) can be updated from ${packageVersion} to ${latestVersion}. ...
// [W0083] Package "${packageName}" (${sourceType}) can be updated from ${packageVersion} to ${latestVersion}. ...
// [W0084] Remove obsolete prettier config files when using "/prettier.config.mjs": ${foundObsoleteFiles.map(file => file.slice(1)).join(', ')}.
// [S0085] No devDependency "@tsconfig/nodeXX" found. Consider adding one for proper type checking (see ioBroker.examples for examples).
// [W0086] "${tsConfigNodeDevDependencyName}" should match the major node.js version from package.json engines.node (>=${minMajor}). Please update @tsconfig/nodeXX at package.json.
// [S0087] Missing "/tsconfig.json". Consider adding it for proper type checking (see ioBroker.examples for examples).
// [S0088] "/tsconfig.json" should use an extends clause like "extends": "@tsconfig/node20/tsconfig.json" (see ioBroker.examples).
// [W0089] "/tsconfig.json" extends "${extendsPath}" but package.json uses "${tsConfigNodeDevDependencyName}". Please update/downgrade the devDependency to match the extends package.
// [W0090] "/tsconfig.json" should be adjusted to match "${tsConfigNodeDevDependencyName}" (for example: "extends": "${tsConfigNodeDevDependencyName}/tsconfig.json").
// [E0091] Could not read "/tsconfig.json": ${e.message || e}

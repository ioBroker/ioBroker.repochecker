'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Adapter Repository
    Numbering   :   4000 - 4999

*/

const axios = require('axios');
const compareVersions = require('compare-versions');
const JSON5 = require('json5');

// disable axios caching
// axios.defaults.headers = {
//     'Cache-Control': 'no-cache',
//     Pragma: 'no-cache',
//     Expires: '0',
// };

const common = require('./common.js');
const config = require('./config.js');

async function checkRepository(context) {
    console.log('\n[E4000 - E4999] checking repository');

    if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.type) {
        /* TODO: why check type here ? */
        // download latest repo
        const response = await axios(
            'https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json',
        );
        let body = response.data;
        if (!body) {
            context.errors.push(
                '[E4000] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json',
            );
        } else {
            context.latestRepo = body;
            if (!context.latestRepo[context.adapterName]) {
                context.warnings.push(`[W4001] Cannot find "${context.adapterName}" in latest repository`);

                if (context.adapterName.includes('_')) {
                    context.errors.push('[E4021] Adapter name should use "-" instead of "_"');
                } else {
                    context.checks.push('Adapter name does not have "_"');
                }
            } else {
                context.checks.push('Adapter found in latest repository');

                if (context.latestRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                    context.errors.push(
                        `[E4002] Types of adapter in latest repository and in io-package.json are different "${context.latestRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"`,
                    );
                } else {
                    context.checks.push(
                        `Types of adapter in latest repository and in io-package.json are equal: "${context.latestRepo[context.adapterName].type}"`,
                    );
                }

                if (context.latestRepo[context.adapterName].version) {
                    context.errors.push('[E4003] Version set in latest repository');
                } else {
                    context.checks.push('Version not set in latest repository');
                }

                const url = `https://raw.githubusercontent.com/${context.authorName}/ioBroker.${context.adapterName}/${context.branch}/`;

                if (!context.latestRepo[context.adapterName].icon) {
                    context.errors.push('[E4004] Icon not found in latest repository');
                } else {
                    context.checks.push('Icon found in latest repository');

                    if (!context.latestRepo[context.adapterName].icon.startsWith(`${url}admin/`)) {
                        context.errors.push(
                            `[E4005] Icon must be in the following path: ${url}admin/; correct sources-dist.json`,
                        );
                    } else {
                        context.checks.push('Icon found in latest repository');
                    }
                }
                if (!context.latestRepo[context.adapterName].meta) {
                    context.errors.push('[E4006] Meta URL not found in latest repository; correct sources-dist.json');
                } else {
                    context.checks.push('Meta URL(latest) found in latest repository');

                    if (context.latestRepo[context.adapterName].meta !== `${url}io-package.json`) {
                        context.errors.push(
                            `[E4007] Meta URL must be equal to ${url}io-package.json; correct sources-dist.json`,
                        );
                    } else {
                        context.checks.push('Meta URL (latest) is OK in latest repository');
                    }
                }
            }
        }

        // download stable repo
        let _response = await axios(
            'https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json',
        );
        body = _response.data;
        if (!body) {
            context.errors.push(
                '[E4020] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json',
            );
        } else {
            context.stableRepo = body;
            if (context.stableRepo[context.adapterName]) {
                if (context.stableRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                    context.errors.push(
                        `[E4022] Types of adapter in stable repository and in io-package.json are different "${context.stableRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"`,
                    );
                } else {
                    context.checks.push(
                        `Types of adapter in stable repository and in io-package.json are equal: "${context.stableRepo[context.adapterName].type}"`,
                    );
                }

                if (!context.latestRepo[context.adapterName]) {
                    context.errors.push('[E4023] Adapter was found in stable repository but not in latest repo');
                } else {
                    context.checks.push('Adapter was found in stable repository and in latest repo');
                }

                if (!context.stableRepo[context.adapterName].version) {
                    context.errors.push('[E4024] No version set in stable repository');
                } else {
                    context.checks.push('Version found in stable repository');
                }

                const url = `https://raw.githubusercontent.com/${context.authorName}/ioBroker.${context.adapterName}/${context.branch}/`;

                if (!context.stableRepo[context.adapterName].icon) {
                    context.errors.push('[E4025] Icon not found in stable repository');
                } else {
                    context.checks.push('Icon found in stable repository');

                    if (!context.stableRepo[context.adapterName].icon.startsWith(`${url}admin/`)) {
                        context.errors.push(
                            `[E4026] Icon must be in the following path: ${url}admin/; correct sources-dist-stable.json`,
                        );
                    } else {
                        context.checks.push('Icon (stable) found in latest repository');
                    }
                }

                if (!context.stableRepo[context.adapterName].meta) {
                    context.errors.push('[E4027] Meta URL not found in latest repository; correct sources-dist.json');
                } else {
                    context.checks.push('Meta URL (stable) found in latest repository');

                    if (context.stableRepo[context.adapterName].meta !== `${url}io-package.json`) {
                        context.errors.push(
                            `[E4028] Meta URL must be equal to ${url}io-package.json; correct sources-dist-stable.json`,
                        );
                    } else {
                        context.checks.push('Meta URL (stable) is OK in latest repository');
                    }
                }
            }
        }

        _response = await axios('http://repo.iobroker.live/sources-dist-latest.json');
        body = _response.data;
        if (!body) {
            context.errors.push('[E4029] Cannot download http://repo.iobroker.live/sources-dist-latest.json');
            throw 'Cannot download http://repo.iobroker.live/sources-dist-latest.json'; // ABORT to avoid generating unuseable report
        } else {
            context.latestRepoLive = body;
        }

        _response = await axios('http://repo.iobroker.live/sources-dist.json');
        body = _response.data;
        if (!body) {
            context.errors.push('[E4030] Cannot download http://repo.iobroker.live/sources-dist.json');
            throw 'Cannot download http://repo.iobroker.live/sources-dist.json'; // ABORT to avoid generating unuseable report
        } else {
            context.stableRepoLive = body;
        }

        if (context.latestRepo && context.latestRepoLive && context.stableRepo && context.stableRepoLive) {
            if (context.ioPackageJson.common.dependencies) {
                const dependencies = common.getDependencies(context.ioPackageJson.common.dependencies);
                for (const dependency in dependencies) {
                    if (!context.latestRepoLive[dependency]) {
                        context.errors.push(
                            `[E4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.latestRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            context.warnings.push(
                                `[W4032] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
                            );
                        } else {
                            try {
                                if (
                                    !compareVersions.compare(
                                        versRepository,
                                        versDependency.replace('>=', '').trim(),
                                        '>=',
                                    )
                                ) {
                                    context.errors.push(
                                        `[E4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at latest repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E4035] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
                                );
                            }
                        }
                    }

                    if (!context.stableRepoLive[dependency]) {
                        context.errors.push(
                            `[E4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.stableRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            // format already checked at latest repository check
                            // context.warnings.push(
                            //     `[W4034] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
                            // );
                        } else {
                            try {
                                if (
                                    !compareVersions.compare(
                                        versRepository,
                                        versDependency.replace('>=', '').trim(),
                                        '>=',
                                    )
                                ) {
                                    context.errors.push(
                                        `[E4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at stable repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E4035] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
                                );
                            }
                        }
                    }
                }
            } else {
                context.checks.push('common.dependency check skipped');
            }

            if (context.ioPackageJson.common.globalDependencies) {
                const dependencies = common.getDependencies(context.ioPackageJson.common.globalDependencies);
                for (const dependency in dependencies) {
                    if (!context.latestRepoLive[dependency]) {
                        context.errors.push(
                            `[E4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.latestRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            context.warnings.push(
                                `[W4032] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
                            );
                        } else {
                            try {
                                if (
                                    !compareVersions.compare(
                                        versRepository,
                                        versDependency.replace('>=', '').trim(),
                                        '>=',
                                    )
                                ) {
                                    context.errors.push(
                                        `[E4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at latest repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E4035] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
                                );
                            }
                        }
                    }

                    if (!context.stableRepoLive[dependency]) {
                        context.errors.push(
                            `[E4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.stableRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            context.warnings.push(
                                `[W4034] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
                            );
                        } else {
                            try {
                                if (
                                    !compareVersions.compare(
                                        versRepository,
                                        versDependency.replace('>=', '').trim(),
                                        '>=',
                                    )
                                ) {
                                    context.errors.push(
                                        `[E4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at stable repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E4035] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
                                );
                            }
                        }
                    }
                }
            } else {
                context.checks.push('common.globalDependency check skipped');
            }
        } else {
            context.checks.push(`Dependency checks skipped due to repository access errors`);
        }
    }

    // Check VS Code schema definitions
    await checkVSCodeSchemas(context);

    return context;
    // max number is E449
}

async function checkVSCodeSchemas(context) {
    try {
        // Try to get .vscode/settings.json file
        const vscodeSettings = await common.getFile(context, '/.vscode/settings.json');

        if (!vscodeSettings) {
            // File doesn't exist, suggest adding it
            context.warnings.push(
                '[S4036] Consider adding .vscode/settings.json file with JSON schema definitions for better development experience with Visual Studio Code.',
            );
            return;
        }

        context.checks.push('Found .vscode/settings.json file');

        // Parse the JSON
        let settingsJson;
        try {
            settingsJson = JSON5.parse(vscodeSettings);
        } catch {
            context.errors.push('[E4037] .vscode/settings.json file contains invalid JSON.');
            return;
        }

        // Check if json.schemas exists
        if (!settingsJson['json.schemas']) {
            context.warnings.push(
                '[S4038] .vscode/settings.json file missing "json.schemas" property. Add schema definitions for better IntelliSense support.',
            );
            return;
        }

        const schemas = settingsJson['json.schemas'];
        if (!Array.isArray(schemas)) {
            context.errors.push('[E4039] "json.schemas" property in .vscode/settings.json must be an array.');
            return;
        }

        // Check for io-package.json schema
        const ioPackageSchema = schemas.find(
            schema => schema.fileMatch && schema.fileMatch.includes('io-package.json'),
        );

        if (!ioPackageSchema) {
            context.warnings.push(
                `[W4040] Missing schema definition for "io-package.json" in .vscode/settings.json. Add: {"fileMatch": ["io-package.json"], "url": "${config.schemaUrls['io-package']}"}`,
            );
        } else {
            // Check if URL is correct
            if (ioPackageSchema.url !== config.schemaUrls['io-package']) {
                context.errors.push(
                    `[E4041] Incorrect schema URL for "io-package.json" in .vscode/settings.json. Expected: "${config.schemaUrls['io-package']}", found: "${ioPackageSchema.url}"`,
                );
            } else {
                context.checks.push('Correct io-package.json schema definition found in .vscode/settings.json');
            }
        }

        let usesJsonConfig =
            (context.ioPackageJson.common.adminUI?.config && context.ioPackageJson.common.adminUI?.config === 'json') ||
            (context.ioPackageJson.common.adminUI?.custom && context.ioPackageJson.common.adminUI?.custom === 'json') ||
            (context.ioPackageJson.common.adminUI?.tab && context.ioPackageJson.common.adminUI?.tab === 'json');

        common.debug('Adapter uses jsonConfig, lets check vscode setup');

        // Check for jsonConfig schemas
        const jsonConfigFiles = ['admin/jsonConfig.json', 'admin/jsonCustom.json', 'admin/jsonTab.json'];
        const json5ConfigFiles = ['admin/jsonConfig.json5', 'admin/jsonCustom.json5', 'admin/jsonTab.json5'];

        // Find schema that matches jsonConfig files
        const jsonConfigSchema = schemas.find(
            schema => schema.fileMatch && jsonConfigFiles.every(file => schema.fileMatch.includes(file)),
        );

        if (!jsonConfigSchema) {
            if (usesJsonConfig) {
                context.warnings.push(
                    `[W4042] Missing schema definition for jsonConfig files in .vscode/settings.json. Add: {"fileMatch": ${JSON.stringify(jsonConfigFiles)}, "url": "${config.schemaUrls.jsonConfig}"}`,
                );
            }
        } else {
            // Check if URL is correct
            if (jsonConfigSchema.url !== config.schemaUrls.jsonConfig) {
                context.errors.push(
                    `[E4043] Incorrect schema URL for jsonConfig files in .vscode/settings.json. Expected: "${config.schemaUrls.jsonConfig}", found: "${jsonConfigSchema.url}"`,
                );
            } else {
                context.checks.push('Correct jsonConfig schema definition found in .vscode/settings.json');
            }
        }

        // Check for json5 schema
        const json5ConfigSchema = schemas.find(
            schema => schema.fileMatch && json5ConfigFiles.every(file => schema.fileMatch.includes(file)),
        );

        if (!json5ConfigSchema) {
            if (usesJsonConfig && context.cfg.usesJson5) {
                context.warnings.push(
                    `[W4044] Missing schema definition for JSON5 config files in .vscode/settings.json. Adapt: {"fileMatch": ${JSON.stringify(jsonConfigFiles.concat(json5ConfigFiles))}, "url": "${config.schemaUrls.jsonConfig}"}`,
                );
            }
        } else {
            // Check if URL is correct
            if (json5ConfigSchema.url !== config.schemaUrls.jsonConfig) {
                context.errors.push(
                    `[E4045] Incorrect schema URL for JSON5 config files in .vscode/settings.json. Expected: "${config.schemaUrls.jsonConfig}", found: "${json5ConfigSchema.url}"`,
                );
            } else {
                context.checks.push('Correct JSON5 config schema definition found in .vscode/settings.json');
            }
        }
    } catch (error) {
        // File doesn't exist or cannot be read
        if (error.code === 'ENOENT' || error.message.includes('404')) {
            context.warnings.push(
                '[S4036] Consider adding .vscode/settings.json file with JSON schema definitions for better development experience with Visual Studio Code.',
            );
        } else {
            context.warnings.push(`[W4046] Could not read .vscode/settings.json file: ${error.message}`);
        }
    }
}

exports.checkRepository = checkRepository;

// List of error and warnings used at this module
// ----------------------------------------------

// [4000] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json
// [4001] Cannot find "${context.adapterName}" in latest repository
// [4002] Types of adapter in latest repository and in io-package.json are different "${context.latestRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"
// [4003] Version set in latest repository
// [4004] Icon not found in latest repository
// [4005] Icon must be in the following path: ${url}; correct sources-dist.json
// [4006] Meta URL not found in latest repository; correct sources-dist.json
// [4007] Meta URL must be equal to ${url}io-package.json; correct sources-dist.json
// [4008]
// [4009]
// [4010]
// [4011]
// [4012]
// [4013]
// [4014]
// [4015]
// [4016]
// [4017]
// [4018]
// [4019]
// [4020] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json
// [4021] Adapter name should use "-" instead of "_"
// [4022] Types of adapter in stable repository and in io-package.json are different "${context.stableRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"
// [4023] Adapter was found in stable repository but not in latest repo
// [4024] No version set in stable repository
// [4025] Icon not found in stable repository
// [4026] Icon must be in the following path: ${url}; correct sources-dist-stable.json
// [4027] Meta URL not found in latest repository; correct sources-dist.json
// [4028] Meta URL must be equal to ${url}io-package.json; correct sources-dist-stable.json
// [4029] Cannot download http://repo.iobroker.live/sources-dist-latest.json
// [4030] Cannot download http://repo.iobroker.live/sources-dist.json
// [4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [4031] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [4032] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [4032] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [4033] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [4034] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [4034] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [4035] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}
// [4036] Consider adding .vscode/settings.json file with JSON schema definitions for better development experience with Visual Studio Code.
// [4037] .vscode/settings.json file contains invalid JSON.
// [4038] .vscode/settings.json file missing "json.schemas" property. Add schema definitions for better IntelliSense support.
// [4039] "json.schemas" property in .vscode/settings.json must be an array.
// [4040] Missing schema definition for "io-package.json" in .vscode/settings.json. Add: {"fileMatch": ["io-package.json"], "url": "${config.schemaUrls['io-package']}"}
// [4041] Incorrect schema URL for "io-package.json" in .vscode/settings.json. Expected: "${config.schemaUrls['io-package']}", found: "${ioPackageSchema.url}"
// [4042] Missing schema definition for jsonConfig files in .vscode/settings.json. Add: {"fileMatch": ${JSON.stringify(jsonConfigFiles)}, "url": "${config.schemaUrls.jsonConfig}"}
// [4043] Incorrect schema URL for jsonConfig files in .vscode/settings.json. Expected: "${config.schemaUrls.jsonConfig}", found: "${jsonConfigSchema.url}"
// [4044] Missing schema definition for JSON5 config files in .vscode/settings.json. Add: {"fileMatch": ${JSON.stringify(json5ConfigFiles)}, "url": "${config.schemaUrls.jsonConfig}"}
// [4045] Incorrect schema URL for JSON5 config files in .vscode/settings.json. Expected: "${config.schemaUrls.jsonConfig}", found: "${json5ConfigSchema.url}"
// [4046] Could not read .vscode/settings.json file: ${error.message}

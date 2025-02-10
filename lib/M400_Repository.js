'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Adapter Repository
    Numbering   :   400 - 499

*/

const axios = require('axios');
const compareVersions = require('compare-versions');

// disable axios caching
axios.defaults.headers = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
};

const common = require('./common.js');

async function checkRepository(context) {
    console.log('\ncheckRepository [E400 - E499]');

    if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.type) {
        /* TODO: why check type here ? */
        // download latest repo
        const response = await axios(
            'https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json',
        );
        let body = response.data;
        if (!body) {
            context.errors.push(
                '[E400] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json',
            );
        } else {
            context.latestRepo = body;
            if (!context.latestRepo[context.adapterName]) {
                context.warnings.push(`[W401] Cannot find "${context.adapterName}" in latest repository`);

                if (context.adapterName.includes('_')) {
                    context.errors.push('[E421] Adapter name should use "-" instead of "_"');
                } else {
                    context.checks.push('Adapter name does not have "_"');
                }
            } else {
                context.checks.push('Adapter found in latest repository');

                if (context.latestRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                    context.errors.push(
                        `[E402] Types of adapter in latest repository and in io-package.json are different "${context.latestRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"`,
                    );
                } else {
                    context.checks.push(
                        `Types of adapter in latest repository and in io-package.json are equal: "${context.latestRepo[context.adapterName].type}"`,
                    );
                }

                if (context.latestRepo[context.adapterName].version) {
                    context.errors.push('[E403] Version set in latest repository');
                } else {
                    context.checks.push('Version not set in latest repository');
                }

                const url = `https://raw.githubusercontent.com/${context.authorName}/ioBroker.${context.adapterName}/${context.branch}/`;

                if (!context.latestRepo[context.adapterName].icon) {
                    context.errors.push('[E404] Icon not found in latest repository');
                } else {
                    context.checks.push('Icon found in latest repository');

                    if (!context.latestRepo[context.adapterName].icon.startsWith(`${url}admin/`)) {
                        context.errors.push(
                            `[E405] Icon must be in the following path: ${url}admin/; correct sources-dist.json`,
                        );
                    } else {
                        context.checks.push('Icon found in latest repository');
                    }
                }
                if (!context.latestRepo[context.adapterName].meta) {
                    context.errors.push('[E406] Meta URL not found in latest repository; correct sources-dist.json');
                } else {
                    context.checks.push('Meta URL(latest) found in latest repository');

                    if (context.latestRepo[context.adapterName].meta !== `${url}io-package.json`) {
                        context.errors.push(
                            `[E407] Meta URL must be equal to ${url}io-package.json; correct sources-dist.json`,
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
                '[E420] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json',
            );
        } else {
            context.stableRepo = body;
            if (context.stableRepo[context.adapterName]) {
                if (context.stableRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                    context.errors.push(
                        `[E422] Types of adapter in stable repository and in io-package.json are different "${context.stableRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"`,
                    );
                } else {
                    context.checks.push(
                        `Types of adapter in stable repository and in io-package.json are equal: "${context.stableRepo[context.adapterName].type}"`,
                    );
                }

                if (!context.latestRepo[context.adapterName]) {
                    context.errors.push('[E423] Adapter was found in stable repository but not in latest repo');
                } else {
                    context.checks.push('Adapter was found in stable repository and in latest repo');
                }

                if (!context.stableRepo[context.adapterName].version) {
                    context.errors.push('[E424] No version set in stable repository');
                } else {
                    context.checks.push('Version found in stable repository');
                }

                const url = `https://raw.githubusercontent.com/${context.authorName}/ioBroker.${context.adapterName}/${context.branch}/`;

                if (!context.stableRepo[context.adapterName].icon) {
                    context.errors.push('[E425] Icon not found in stable repository');
                } else {
                    context.checks.push('Icon found in stable repository');

                    if (!context.stableRepo[context.adapterName].icon.startsWith(`${url}admin/`)) {
                        context.errors.push(
                            `[E426] Icon must be in the following path: ${url}admin/; correct sources-dist-stable.json`,
                        );
                    } else {
                        context.checks.push('Icon (stable) found in latest repository');
                    }
                }

                if (!context.stableRepo[context.adapterName].meta) {
                    context.errors.push('[E427] Meta URL not found in latest repository; correct sources-dist.json');
                } else {
                    context.checks.push('Meta URL (stable) found in latest repository');

                    if (context.stableRepo[context.adapterName].meta !== `${url}io-package.json`) {
                        context.errors.push(
                            `[E428] Meta URL must be equal to ${url}io-package.json; correct sources-dist-stable.json`,
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
            context.errors.push('[E429] Cannot download http://repo.iobroker.live/sources-dist-latest.json');
            throw 'Cannot download http://repo.iobroker.live/sources-dist-latest.json'; // ABORT to avoid generating unuseable report
        } else {
            context.latestRepoLive = body;
        }

        _response = await axios('http://repo.iobroker.live/sources-dist.json');
        body = _response.data;
        if (!body) {
            context.errors.push('[E430] Cannot download http://repo.iobroker.live/sources-dist.json');
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
                            `[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.latestRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            context.warnings.push(
                                `[W432] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
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
                                        `[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at latest repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E435] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
                                );
                            }
                        }
                    }

                    if (!context.stableRepoLive[dependency]) {
                        context.errors.push(
                            `[E433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.stableRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            // format already checked at latest repository check
                            // context.warnings.push(
                            //     `[W434] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
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
                                        `[E433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at stable repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E435] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
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
                            `[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.latestRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            context.warnings.push(
                                `[W432] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
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
                                        `[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at latest repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E435] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
                                );
                            }
                        }
                    }

                    if (!context.stableRepoLive[dependency]) {
                        context.warnings.push(
                            `[W433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                        );
                    } else {
                        const versDependency = dependencies[dependency];
                        const versRepository = context.stableRepoLive[dependency].version;
                        //console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                        if (!versDependency.startsWith('>=')) {
                            context.warnings.push(
                                `[W434] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`,
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
                                        `[E433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`,
                                    );
                                } else {
                                    context.checks.push(
                                        `Dependency '${dependency}':'${dependencies[dependency]}' available at stable repository`,
                                    );
                                }
                            } catch (e) {
                                context.errors.push(
                                    `[E435] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}`,
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
    return context;
    // max number is E429
}

exports.checkRepository = checkRepository;

// List of error and warnings used at this module
// ----------------------------------------------

// [400] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json
// [401] Cannot find "${context.adapterName}" in latest repository
// [402] Types of adapter in latest repository and in io-package.json are different "${context.latestRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"
// [403] Version set in latest repository
// [404] Icon not found in latest repository
// [405] Icon must be in the following path: ${url}; correct sources-dist.json
// [406] Meta URL not found in latest repository; correct sources-dist.json
// [407] Meta URL must be equal to ${url}io-package.json; correct sources-dist.json
// [408]
// [409]
// [410]
// [411]
// [412]
// [413]
// [414]
// [415]
// [416]
// [417]
// [418]
// [419]
// [420] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json
// [421] Adapter name should use "-" instead of "_"
// [422] Types of adapter in stable repository and in io-package.json are different "${context.stableRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"
// [423] Adapter was found in stable repository but not in latest repo
// [424] No version set in stable repository
// [425] Icon not found in stable repository
// [426] Icon must be in the following path: ${url}; correct sources-dist-stable.json
// [427] Meta URL not found in latest repository; correct sources-dist.json
// [428] Meta URL must be equal to ${url}io-package.json; correct sources-dist-stable.json
// [429] Cannot download http://repo.iobroker.live/sources-dist-latest.json
// [430] Cannot download http://repo.iobroker.live/sources-dist.json
// [431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository
// [432] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [432] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository
// [434] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [434] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='
// [435] Dependency '${dependency}':'${dependencies[dependency]}' cannot be parsed - ${e}

'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   io-package.json
    Numbering   :   100 - 199, 250 - 249

*/

const compareVersions = require('compare-versions');
const sizeOf = require('image-size');

const common = require('./common.js');

async function getIOPackageJson(context) {
    console.log('\ngetIOPackageJson');

    const ioPackageJson = await common.downloadFile(context.githubUrl, '/io-package.json')
    context.ioPackageJson = ioPackageJson;
    if (typeof context.ioPackageJson === 'string') {
        try {
            context.ioPackageJson = JSON.parse(context.ioPackageJson);
        } catch (e) {
            context.errors.push(`[E100] Cannot parse ioPackage.json: ${e}`);
        }
    }
    return context;
}

const recommendedJsControllerVersion = '5.0.19';
let requiredJsControllerVersion = '4.0.24';
const recommendedNodeVersion = '18'; // This is the minimum node version that should be required
const requiredNodeVersion = '16';    // This is the minimum node version that must be required

const blacklistIOPackageJson = {
    installedFrom: {
        msg: '"installedFrom" is invalid at io-package.json. Please remove.',
        err:true
    },
    'common.installedFrom': {
        msg: '"common.installedFrom" is invalid. Please remove from io-package.json.',
        err:true
    },
    'common.title': {
        msg: '"common.title" is deprecated and replaced by "common.titleLang". Please remove from io-package.json.',
        err:false
    },
    'common.main': {
        msg: '"common.main" is deprecated and ignored. Please remove from io-package.json. Use "main" at package.json instead.',
        err:false
    },
    'common.materialize': {
        msg: '"common.materialize" is deprecated for admin >= 5 at io-package.json. Please use property "adminUI".',
        err:false
    },
    'common.materializeTab': {
        msg: '"common.materializeTab" is deprecated for admin >= 5 at io-package.json. Please use property "adminUI".',
        err:false
    },
    'common.noConfig': {
        msg: '"common.noConfig" is deprecated for admin >= 5 at io-package.json. Please use property "adminUI.config":"none".',
        err:false
    },
    'common.subscribe': {
        msg: '"common.subscribe" will be removed with js-controller >= 6. Please remove from io-package.json and adapt code if required.',
        err:true
    },
    'common.wakeup': {
        msg: '"common.wakeup" is deprecated and ignored. Please remove from io-package.json.',
        err:true
    },
};


async function checkIOPackageJson(context) {
    console.log('\ncheckIOPackage [E100 - E249]');

    if (!context.ioPackageJson.native) {
        context.errors.push('[E101] io-package.json must have at least empty "native" attribute');
    } else {
        context.checks.push('"native" found in io-package.json');

        // Generic check for potential credentials that should have a counterpart in encryptedNative/protectedNative
        const suspiciousPhrases = [
            'apikey',
            'api_key',
            'credential',
            'pass',
            'passwd',
            'password',
            'passwort',
            'pin',
            'private_pw',
            'psk',
            'pwd',
            'secret',
            'token',
        ];
        //const regex = new RegExp(suspiciousPhrases.join('|'), 'i');

        let suspiciousKeys = Object.keys(context.ioPackageJson.native) || [];
        // console.log(`native keys: ${suspiciousKeys.join()}`);
        //suspiciousKeys = suspiciousKeys.filter( key => regex.test(key));
        suspiciousKeys = suspiciousKeys.filter( key => suspiciousPhrases.includes(key.toLowerCase()));
        // console.log(`suspicious keys: ${suspiciousKeys.join()}`);

        if ( suspiciousKeys.length) {
            if (context.ioPackageJson.protectedNative) {
                const missingProtected = suspiciousKeys.filter( key => !context.ioPackageJson.protectedNative.includes(key));
                if (missingProtected.length) context.warnings.push( `[W173] Potential sensitive data "${missingProtected.join()}" not listed at "protectedNative" in io-package.json`);
            } else {
                context.warnings.push( `[W173] Potential sensitive data "${suspiciousKeys.join()}" not listed at "protectedNative" in io-package.json`);
            }

            if (context.ioPackageJson.encryptedNative) {
                const missingProtected = suspiciousKeys.filter( key => !context.ioPackageJson.encryptedNative.includes(key));
                if (missingProtected.length) context.warnings.push( `[W174] Potential sensitive data "${missingProtected.join()}" not listed at "encryptedNative" in io-package.json`);
            } else {
                context.warnings.push( `[W174] Potential sensitive data "${suspiciousKeys.join()}" not listed at "encryptedNative" in io-package.json`);
            }
        }
    }

    if (!context.ioPackageJson.common) {
        context.errors.push('[E102] io-package.json must have common object');
        return resolve(context);
    } else {
        context.checks.push('"common" found in io-package.json');
        if (!context.ioPackageJson.common.name || context.ioPackageJson.common.name !== context.adapterName.toLowerCase()) {
            context.errors.push(`[E103] "common.name" in io-package.json must be equal to "${context.adapterName.toLowerCase()}'". Now is ${context.ioPackageJson.common.name}`);
        } else {
            context.checks.push('"common.name" is valid in io-package.json');
        }

        /*
    if (context.ioPackageJson.common.title) {
        context.warnings.push('[W158] "common.title" is deprecated in io-package.json. Please remove from io-package.json.');
    }

    if (context.ioPackageJson.common.main) {
        context.warnings.push('[W177] "common.main" is deprecated in io-package.json. For js-controller >= 3.3 please use package.json main and remove "common.main" from io-package.json.');
    }

    if (context.ioPackageJson.common.materialize) {
        context.warnings.push('[W178] "common.materialize" is deprecated in io-package.json. For admin version >= 5 please use the property "common.adminUI"');
    }

    if (context.ioPackageJson.common.materializeTab) {
        context.warnings.push('[W179] "common.materializeTab" is deprecated in io-package.json. For admin version >= 5 please use the property "common.adminUI".');
    }

    if (context.ioPackageJson.common.noConfig) {
        context.warnings.push('[W180] "common.noConfig" is deprecated in io-package.json.  For admin version >= 5 please use "common.adminUI.config":"none".');
    }
*/
        if (!context.ioPackageJson.common.titleLang) {
            context.errors.push('[E104] No "common.titleLang" found in io-package.json');
        } else {
            context.checks.push('"common.titleLang" found in io-package.json');

            if (typeof context.ioPackageJson.common.titleLang !== 'object') {
                context.errors.push(`[E105] "common.titleLang" must be an object. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}`);
            } else {
                let missingLang = common.checkLanguages(context.ioPackageJson.common.titleLang, context.cfg.requiredLanguages);
                if (missingLang.length) {
                    context.errors.push(`[E126] Missing mandatory translation into ${missingLang.join()} of "common.titleLang" in io-package.json.`);
                }

                missingLang = common.checkLanguages(context.ioPackageJson.common.titleLang, context.cfg.allowedLanguages);
                missingLang = missingLang.filter( lang => !context.cfg.requiredLanguages.includes(lang));
                if (missingLang.length) {
                    missingLang = [... new Set(missingLang)];  // make unique
                    context.warnings.push(`[W127] Missing suggested translation into ${missingLang.join()} of "common.titleLang" in io-package.json.`);
                }
            }

            Object.keys(context.ioPackageJson.common.titleLang).forEach(lang => {
                const text = context.ioPackageJson.common.titleLang[lang];
                if (text.match(/iobroker/i)) {
                    context.errors.push(`[E106] "common.titleLang" must not have ioBroker in the name. It is clear, for what this adapter was created. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}`);
                } else {
                    context.checks.push('"common.titleLang" has no ioBroker in it in io-package.json');
                }

                if (text.match(/\sadapter|adapter\s/i)) {
                    context.warnings.push(`[W128] "common.titleLang" should not contain word "adapter" in the name. It is clear, that this is adapter. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}`);
                } else {
                    context.checks.push('"common.titleLang" has no "adapter" in it in io-package.json');
                }
            });
        }

        if (!context.ioPackageJson.common.version) {
            context.errors.push('[E107] No "common.version" found in io-package.json');
        } else {
            context.checks.push('"common.version" found in io-package.json');

            if (!context.packageJson || context.ioPackageJson.common.version !== context.packageJson.version) {
                context.errors.push('[E118] Versions in package.json and in io-package.json are different');
            } else {
                context.checks.push('"common.version" is equal in package.json adn in io-package.json');
            }
        }

        if (!context.ioPackageJson.common.desc) {
            context.errors.push('[E108] No "common.desc" found in io-package.json');
        } else {
            context.checks.push('"common.desc" found in io-package.json');

            if (typeof context.ioPackageJson.common.desc !== 'object') {
                context.errors.push(`[E109] "common.desc" in io-package.json must be an object for many languages. Found only "${context.ioPackageJson.common.desc}"`);
            } else {

                let missingLang = common.checkLanguages(context.ioPackageJson.common.desc, context.cfg.requiredLanguages);
                if (missingLang.length) {
                    context.warnings.push(`[E133] Missing mandatory translation into ${missingLang.join()} of "common.desc" in io-package.json.`);
                }

                missingLang = common.checkLanguages(context.ioPackageJson.common.desc, context.cfg.allowedLanguages);
                missingLang = missingLang.filter( lang => !context.cfg.requiredLanguages.includes(lang));
                if (missingLang.length) {
                    missingLang = [... new Set(missingLang)];  // make unique
                    context.warnings.push(`[W134] Missing suggested translation into ${missingLang.join()} of "common.desc" in io-package.json.`);
                }
            }
        }

        if (! context.ioPackageJson.common.keywords) {
            context.errors.push('[E169] "common.keywords" must be an array within io-package.json and contain some useful keywords');
        } else {
            const forbiddenKeywords = ['iobroker', 'adapter', 'smart home'];
            if (!Array.isArray(context.ioPackageJson.common.keywords)) {
                context.errors.push('[E169] "common.keywords" must be an array within io-package.json and contain some useful keywords');
            } else if (context.ioPackageJson.common.keywords.length === 0) {
                context.errors.push('[E169] "common.keywords" must be an array within io-package.json and contain some useful keywords');
            } else if (forbiddenKeywords.filter(keyword => context.ioPackageJson.common.keywords.map(k => k.toLowerCase()).includes(keyword)).length > 0) {
                context.warnings.push(`[W168] "common.keywords" should not contain "${forbiddenKeywords.join(', ')}" io-package.json`);
            }

            context.checks.push('"common.keywords" found in io-package.json');
        }

        if (!context.ioPackageJson.common.icon) {
            context.errors.push('[E110] Icon not found in the io-package.json');
        } else {
            context.checks.push('"common.icon" found in io-package.json');
        }

        if (!context.ioPackageJson.common.extIcon) {
            context.errors.push('[E111] extIcon not found in the io-package.json');
        } else {
            context.checks.push('"common.extIcon" found in io-package.json');

            // extract icon name
            let fileName = context.ioPackageJson.common.extIcon;
            let pos = fileName.indexOf('?');

            if (pos !== -1) {
                fileName = fileName.substring(0, pos);
            }
            pos = fileName.lastIndexOf('/');
            fileName = fileName.substring(pos + 1, fileName.length);

            if (fileName !== context.ioPackageJson.common.icon) {
                context.errors.push('[E112] extIcon must be the same as an icon but with github path');
            } else {
                context.checks.push('"common.extIcon" has same path as repo in io-package.json');
            }
        }

        if (!context.ioPackageJson.common.compact && !context.ioPackageJson.common.onlyWWW) {
            context.warnings.push('[W113] Adapter should support compact mode');
        } else if (!context.ioPackageJson.common.onlyWWW) {
            context.checks.push('"common.compact" found in io-package.json');
        }

        if (context.ioPackageJson.common.noConfig &&
        (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config !== 'none')
        ) {
            context.errors.push('[E114] "common.noConfig=true" requires "common.adminUI.config" to be set to "none"' );
        }
        if (!context.ioPackageJson.common.materialize &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'json') &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'materialize') &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'html') &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'none')
        ) {
            context.errors.push('[E129] Admin support not specified. Please add "common.adminUI.config = json|materialize|html|none"');
        } else {
            context.checks.push('"common.materialize" or valid "common.adminUI.config:xxx" found in io-package.json');
        }

        if (context.ioPackageJson.common.license) {
            context.warnings.push('[W181] "common.license" in io-package.json is deprecated. Please define object "common.licenseInformation"');
        }

        if (!context.ioPackageJson.common.licenseInformation) {
            if (!context.ioPackageJson.common.license) {
                context.errors.push('[E115] "common.licenseInformation" not found in io-package.json');
            }
        } else {
            context.checks.push('"common.licenseInformation" found in io-package.json');

            if (context.ioPackageJson.common.license) {
                context.errors.push('[E182] Please remove "common.license" from io-package.json as "common.licenseInformation" is declared.');
            }

            // check if license valid
            if (!context.ioPackageJson.common.licenseInformation.license) {
                context.errors.push('[E183] "common.licenseInformation.license" is missing');
            } else if (!context.cfg.allowedLicenses.includes(context.ioPackageJson.common?.licenseInformation?.license)) {
                context.errors.push('[E116] No SPDX license found at "common.licenseInformation". Please use one of listed here: https://spdx.org/licenses/');
            } else {
                context.checks.push('"common.licenseInformation" is valid in io-package.json');
            }

            // check if type is valid
            if (!['free', 'paid', 'commercial', 'limited'].includes(context.ioPackageJson.common?.licenseInformation?.type)) {
                context.errors.push('[E170] "common.licenseInformation.type" is invalid. Select valid type (e.g. free)');
            } else {
                context.checks.push('"common.licenseInformation.type" is valid in io-package.json');

                if (['paid', 'commercial', 'limited'].includes(context.ioPackageJson.common?.licenseInformation?.type)) {
                    if (!context.ioPackageJson.common?.licenseInformation?.link) {
                        context.errors.push('[E171] "common.licenseInformation.link" is required for non-free adapters');
                    } else {
                        context.checks.push('"common.licenseInformation.link" is valid in io-package.json');
                    }
                }
            }

            if (!context.packageJson ||
            context.ioPackageJson.common?.licenseInformation?.license !== context.packageJson.license) {
                context.errors.push('[E117] Licenses in package.json and in io-package.json are different');
            } else {
                context.checks.push('"common.licenseInformation.license" is equal in package.json and in io-package.json');
            }
        }

        if (!context.ioPackageJson.common.mode) {
            context.errors.push('[E165] "common.mode" not found in io-package.json');
        } else {
            context.checks.push('"common.mode" found in io-package.json');

            if (!context.cfg.allowedModes[context.ioPackageJson.common.mode]) {
                context.errors.push(`[E166] "common.mode: ${context.ioPackageJson.common.mode}" is unknown in io-package.json.`);
            } else {
                context.checks.push('"common.mode" has known mode in io-package.json');

                if (context.ioPackageJson.common.onlyWWW && context.ioPackageJson.common.mode !== 'none') {
                    context.errors.push('[E164] onlyWWW should have common.mode "none" in io-package.json');
                }

                if (context.ioPackageJson.common.mode === 'schedule' && !context.ioPackageJson.common.schedule) {
                    context.errors.push('[E167] scheduled adapters must have "common.schedule" property in io-package.json');
                }
            }
        }

        if (!context.ioPackageJson.common.type) {
            context.errors.push('[E119] No type found in io-package.json');
        } else {
            context.checks.push('"common.type" found in io-package.json');

            if (!context.cfg.allowedTypes[context.ioPackageJson.common.type]) {
                context.errors.push('[E120] Unknown type found in io-package.json');
            } else {
                context.checks.push('"common.type" has known type in io-package.json');
            }
        }

        if (!context.ioPackageJson.common.authors) {
            context.errors.push('[E121] No authors found in io-package.json');
        } else {
            context.checks.push('"common.authors" found in io-package.json');

            if (!(context.ioPackageJson.common.authors instanceof Array)) {
                context.errors.push('[E122] authors must be an Array in io-package.json');
            } else {
                context.checks.push('"common.authors" is array in io-package.json');
            }

            if (!context.ioPackageJson.common.authors.length) {
                context.errors.push('[E123] Authors may not be empty in io-package.json');
            } else {
                context.checks.push('"common.authors" is not empty in io-package.json');
            }
        }

        if (context.ioPackageJson.common.localLink) {
            context.warnings.push('[W172] "common.localLink" in io-package.json is deprecated. Please define object "common.localLinks": { "_default": "..." }');
        } else {
            context.checks.push('No "common.localLink" found in io-package.json');
        }

        if (!context.ioPackageJson.common.news) {
            context.errors.push('[E130] No "common.news" found in io-package.json');
        } else {
            context.checks.push('"common.news" found in io-package.json');

            if (Object.keys(context.ioPackageJson.common.news).length > 20) {
                context.errors.push('[E131] Too many "common.news" found in io-package.json. Must be less than 20. Please remove old news.');
            } else if (Object.keys(context.ioPackageJson.common.news).length > 7) {
                context.warnings.push('[W132] Many "common.news" found in io-package.json. Repository builder will truncate at 7 news. Please remove old news.');
            }

            Object.keys(context.ioPackageJson.common.news).forEach(version => {
                if (!compareVersions.validateStrict(version)) {
                    context.errors.push(`[E175] Release "${version}" at "common.news" in io-package.json is malformed.`);
                }
            });

            if (!context.ioPackageJson.common.news[context.ioPackageJson.common.version]) {
                context.errors.push(`[E136] No "common.news" found for actual version ${context.ioPackageJson.common.version} in io-package.json`);
            }

            let missingLang =[];
            Object.keys(context.ioPackageJson.common.news).forEach(version => {
                missingLang = missingLang.concat( common.checkLanguages(context.ioPackageJson.common.news[version], context.cfg.requiredLanguages) );
            });
            if (missingLang.length) {
                missingLang = [... new Set(missingLang)]; // make unique
                context.warnings.push(`[E145] Missing mandatory translation into ${missingLang.join()} of some "common.news" in io-package.json.`);
            }

            missingLang =[];
            Object.keys(context.ioPackageJson.common.news).forEach(version => {
                missingLang = missingLang.concat(common.checkLanguages(context.ioPackageJson.common.news[version], context.cfg.allowedLanguages));
            });
            missingLang = missingLang.filter( lang => !context.cfg.requiredLanguages.includes(lang));
            if (missingLang.length) {
                missingLang = [... new Set(missingLang)];  // make unique
                context.warnings.push(`[W154] Missing suggested translation into ${missingLang.join()} of some "common.news" in io-package.json.`);
            }

        }

        // now check the package.json again, because it is valid only for onlyWWW
        if (!context.packageJson.main) {
            !context.ioPackageJson.common.onlyWWW && context.errors.push('[E143] No main found in the package.json');
        } else {
            context.checks.push('"main" found in package.json');

            if (context.ioPackageJson.common.mode !== 'none' && !context.packageJson.main.endsWith('.js')) {
                !context.ioPackageJson.common.onlyWWW && context.errors.push(`[E163] common.mode "${context.ioPackageJson.common.mode}" requires JavaScript file for "main" in package.json`);
            }
        }

        //if (context.ioPackageJson.common.installedFrom) {
        //    context.errors.push('[E144] common.installedFrom field found in io-package.json. Must be removed.');
        //}

        if (context.ioPackageJson.instanceObjects) {
            const instanceObjects = context.ioPackageJson.instanceObjects;
            if (!(instanceObjects instanceof Array)) {
                context.errors.push('[E146] instanceObjects must be an Array in io-package.json');
            } else {
                const allowedObjectTypes = ['state', 'channel', 'device', 'enum', 'host', 'adapter', 'instance', 'meta', 'config', 'script', 'user', 'group', 'chart', 'folder'];
                const allowedStateTypes = ['number', 'string', 'boolean', 'array', 'object', 'mixed', 'file', 'json'];

                instanceObjects.forEach(instanceObject => {
                    if (instanceObject.type !== undefined && !allowedObjectTypes.includes(instanceObject.type)) {
                        context.errors.push(`[E147] instanceObject type has an invalid type: ${instanceObject.type}`);
                    }

                    if (instanceObject.common) {
                        if (instanceObject.common.type !== undefined) {
                            if (typeof instanceObject.common.type !== 'string') {
                                context.errors.push(`[E148] instanceObject common.type has an invalid type! Expected "string", received  "${typeof instanceObject.common.type}"`);
                            }

                            if (instanceObject.type === 'state' && !allowedStateTypes.includes(instanceObject.common.type)) {
                                context.errors.push(`[E149] instanceObject common.type has an invalid value: ${instanceObject.common.type}`);
                            }
                        }
                    }
                });
            }
        }

        if (!context.ioPackageJson.common.connectionType) {
            !context.ioPackageJson.common.onlyWWW && context.errors.push('[E150] No "common.connectionType" found in io-package.json');
        } else if (!['local', 'cloud', 'none'].includes(context.ioPackageJson.common.connectionType)) {
            context.errors.push(`[E151] "common.connectionType" type has an invalid value "${context.ioPackageJson.common.connectionType}"`);
        }

        if (!context.ioPackageJson.common.dataSource) {
            !context.ioPackageJson.common.onlyWWW && context.errors.push('[E152] No "common.dataSource" found in io-package.json');
        } else if (!['poll', 'push', 'assumption', 'none'].includes(context.ioPackageJson.common.dataSource)) {
            context.errors.push(`[E153] "common.dataSource" type has an invalid value "${context.ioPackageJson.common.dataSource}"`);
        }

        let currentJsControllerVersion = undefined;

        if (context.ioPackageJson.common.dependencies) {
            if (!(context.ioPackageJson.common.dependencies instanceof Array)) {
                context.errors.push(`[E185] "common.dependencies" must be an array at io-package.json`);
            } else {
                const dependencyArray = common.getDependencyArray(context.ioPackageJson.common.dependencies);

                // Admin is not allowed in dependencies (globalDependencies only)
                if (dependencyArray.includes('admin')) {
                    context.errors.push(`[E160] "admin" is not allowed in common.dependencies`);
                }

                const jsControllerDependency = context.ioPackageJson.common.dependencies.find(dep => Object.keys(dep).find(attr => attr === 'js-controller'));
                if (jsControllerDependency) {
                    console.log(`Found current js-controller dependency "${jsControllerDependency['js-controller']}"`);

                    if (!jsControllerDependency['js-controller'].startsWith('>=')) {
                        context.errors.push(`[E159] common.dependencies "js-controller" dependency should always allow future versions (>=x.x.x) - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                    } else {
                        currentJsControllerVersion = jsControllerDependency['js-controller'].replace(/[^\d.]/g, '');
                    }
                } else {
                    context.errors.push(`[E162] js-controller dependency missing. js-controller ${requiredJsControllerVersion} is required as minimum, ${recommendedJsControllerVersion} is recommended. Please add to dependencies at io-package.json.`);
                }
            }
        }

        /*
        increase dependency as required by addition features
    */
        if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.supportedMessges) {
            requiredJsControllerVersion = common.maxVersion( requiredJsControllerVersion, '5.0.18');
        }
        if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.nodeProcessParams) {
            requiredJsControllerVersion = common.maxVersion( requiredJsControllerVersion, '5.0.18');
        }


        if ( currentJsControllerVersion && compareVersions.compare( requiredJsControllerVersion, currentJsControllerVersion, '>' )) {
            context.errors.push(`[E157] js-controller ${currentJsControllerVersion} listed as dependency but ${requiredJsControllerVersion} is required as minimum, ${recommendedJsControllerVersion} is recommended. Please update dependency at io-package.json.`);
        } else if ( currentJsControllerVersion && compareVersions.compare( recommendedJsControllerVersion, currentJsControllerVersion, '>' )) {
            context.warnings.push(`[W156] js-controller ${currentJsControllerVersion} listed as dependency but ${recommendedJsControllerVersion} is recommended. Please consider updating dependency at io-package.json.`);
        }

        if (context.ioPackageJson.common.globalDependencies) {
            const dependencyArray = common.getDependencyArray(context.ioPackageJson.common.globalDependencies);

            if (!(context.ioPackageJson.common.globalDependencies instanceof Array)) {
                context.errors.push(`[E186] "common.globalDependencies" must be an array at io-package.json`);
            } else {
            // js-controller is not allowed in global dependencies (dependencies only)
                if (dependencyArray.includes('js-controller')) {
                    context.errors.push(`[E161] "js-controller" is not allowed in common.globalDependencies`);
                }
            }

        }


        if (!context.ioPackageJson.common.onlyWWW) {
            if (!context.ioPackageJson.common.tier) {
                context.warnings.push(`[W135] "common.tier" is required in io-package.json. Please check https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#adapter.`);
            } else if (![1, 2, 3].includes(context.ioPackageJson.common.tier)) {
                context.errors.push(`[E155] Invalid "common.tier" value: ${context.ioPackageJson.common.tier} at io-package.json. Only 1, 2 or 3 are allowed!`);
            } else {
                context.checks.push('"common.tier" is valid in io-package.json');
            }
        } else {
            context.checks.push('"common.tier" check skipped for wwwOnly adapter.');
        }

        if (context.ioPackageJson.common.automaticUpgrade) {
            context.errors.push(`[E137] "common.automaticUpgrade" will be defined by the user. Please remove from io-package.json`);
        } else {
            context.checks.push('"common.automaticUpgrade" does not exist in io-package.json');
        }

        if (context.ioPackageJson.common.restartAdapters) {
            const restartAdaptersArray = context.ioPackageJson.common.restartAdapters;

            // own adapter is not allowed in a restart array
            if (restartAdaptersArray.includes(context.ioPackageJson.common.name)) {
                context.errors.push(`[E176] Own adapter is not allowed to be listed at "common.restartAdapters" in io-package.json`);
            } else {
                context.checks.push('Own adapter not listed at "common.restartAdapters".');
            }
        } else {
            context.checks.push('"restartAdapters" check skipped as object not present.');
        }

        for (const blacklist in blacklistIOPackageJson) {
        //console.log(`checking blacklist ${blacklist}`);
            let tmp = context.ioPackageJson;
            let log = '';
            for (const element of blacklist.split('.')) {
                log = `${log}.${element}`;
                //console.log(`   check ${log}`);
                tmp = tmp[element];
                if ( !tmp ) {
                //console.log(`   ${log} does not exist`);
                    break;
                }
            }
            if (tmp) {
                if (blacklistIOPackageJson[blacklist].err) {
                    context.errors.push(`[E184] ${blacklistIOPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W184] ${blacklistIOPackageJson[blacklist].msg}`);
                }
            }
        //else {
        //    console.log(`blacklist ${blacklist} no match`);
        //}
        }
        context.checks.push('"blacklist (io-package)" checked.');

        if (context.ioPackageJson.common.extIcon) {
            try {
                const icon = await common.downloadFile(context.ioPackageJson.common.extIcon, null, true);
                context.checks.push('"extIcon" could be downloaded');

                const image = sizeOf(icon);
                if (image.width !== image.height) {
                    context.errors.push('[E140] width and height of logo are not equal');
                } else {
                    context.checks.push('Width and height of logo are equal');
                    if (image.width < 32) {
                        context.errors.push('[E141] logo is too small. It must be greater or equal than 32x32');
                    } else if (image.width > 512) {
                        context.errors.push('[E142] logo is too big. It must be less or equal than 512x512');
                    }
                }
            } catch (e) {
                common.debug (e);
                context.errors.push(`[E125] External icon not found under URL: ${context.ioPackageJson.common.extIcon}`);
            }
        }

        if (!context.ioPackageJson.common.onlyWWW && context.packageJson.main) {
            try {
                await common.downloadFile(context.githubUrl, `/${context.packageJson.main}`)
                context.checks.push(`${context.packageJson.main} could be downloaded`);
            } catch (e) {
                common.debug (e);
                context.errors.push(`[E124] Main file not found under URL: ${context.githubUrl}/${context.packageJson.main}`);
            }
        }
    }

    // single free 138, 139
    // first free 187

    return context;
}

exports.getIOPackageJson = getIOPackageJson;
exports.checkIOPackageJson = checkIOPackageJson;

// List of error and warnings used at this module
// ----------------------------------------------

// [100] Cannot parse ioPackage.json: ${e}
// [101] io-package.json must have at least empty "native" attribute
// [102] io-package.json must have common object
// [103] "common.name" in io-package.json must be equal to "${context.adapterName.toLowerCase()}'". Now is ${context.ioPackageJson.common.name}
// [104] No "common.titleLang" found in io-package.json
// [105] "common.titleLang" must be an object. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}
// [106] "common.titleLang" must not have ioBroker in the name. It is clear, for what this adapter was created. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}
// [107] No "common.version" found in io-package.json
// [108] No "common.desc" found in io-package.json
// [109] "common.desc" in io-package.json must be an object for many languages. Found only "${context.ioPackageJson.common.desc}"
// [110] Icon not found in the io-package.json
// [111] extIcon not found in the io-package.json
// [112] extIcon must be the same as an icon but with github path
// [113] Adapter should support compact mode
// [114] "common.noConfig=true" requires "common.adminUI.config" to be set to "none"'
// [115] "common.licenseInformation" not found in io-package.json
// [116] No SPDX license found at "common.licenseInformation". Please use one of listed here: https://spdx.org/licenses/
// [117] Licenses in package.json and in io-package.json are different
// [118] Versions in package.json and in io-package.json are different
// [119] No type found in io-package.json
// [120] Unknown type found in io-package.json
// [121] No authors found in io-package.json
// [122] authors must be an Array in io-package.json
// [123] Authors may not be empty in io-package.json
// [124] Main file not found under URL: ${context.githubUrl}/${context.packageJson.main}
// [125] External icon not found under URL: ${context.ioPackageJson.common.extIcon}
// [126] Missing mandatory translation into ${missingLang.join()} of "common.titleLang" in io-package.json.
// [127] Missing suggested translation into ${missingLang.join()} of "common.titleLang" in io-package.json.
// [128] "common.titleLang" should not contain word "adapter" in the name. It is clear, that this is adapter. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}
// [129] Admin support not specified. Please add "common.adminUI.config = json|materialize|html|none"
// [130] No "common.news" found in io-package.json
// [131] Too many "common.news" found in io-package.json. Must be less than 20. Please remove old news.
// [132] Many "common.news" found in io-package.json. Repository builder will truncate at 7 news. Please remove old news.
// [133] Missing mandatory translation into ${missingLang.join()} of "common.desc" in io-package.json.
// [134] Missing suggested translation into ${missingLang.join()} of "common.desc" in io-package.json.
// [135] "common.tier" is required in io-package.json. Please check https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#adapter.
// [136] No "common.news" found for actual version ${context.ioPackageJson.common.version} in io-package.json
// [137] "common.automaticUpgrade" will be defined by the user. Please remove from io-package.json
// [138]
// [139]
// [140] width and height of logo are not equal
// [141] logo is too small. It must be greater or equal than 32x32
// [142] logo is too big. It must be less or equal than 512x512
// [143] No main found in the package.json
// [144] common.installedFrom field found in io-package.json. Must be removed.
// [145] Missing mandatory translation into ${missingLang.join()} of some "common.news" in io-package.json.
// [146] instanceObjects must be an Array in io-package.json
// [147] instanceObject type has an invalid type: ${instanceObject.type}
// [148] instanceObject common.type has an invalid type! Expected "string", received  "${typeof instanceObject.common.type}"
// [149] instanceObject common.type has an invalid value: ${instanceObject.common.type}
// [150] No "common.connectionType" found in io-package.json
// [151] "common.connectionType" type has an invalid value "${context.ioPackageJson.common.connectionType}"
// [152] No "common.dataSource" found in io-package.json
// [153] "common.dataSource" type has an invalid value "${context.ioPackageJson.common.dataSource}"
// [154] Missing suggested translation into ${missingLang.join()} of some "common.news" in io-package.json.
// [155] Invalid "common.tier" value: ${context.ioPackageJson.common.tier} at io-package.json. Only 1, 2 or 3 are allowed!
// [156] js-controller ${currentJsControllerVersion} listed as dependency but ${recommendedJsControllerVersion} is recommended. Please consider updating dependency at io-package.json.
// [157] js-controller ${currentJsControllerVersion} listed as dependency but ${requiredJsControllerVersion} is required as minimum, ${recommendedJsControllerVersion} is recommended. Please update dependency at io-package.json.
// [158] "common.title" is deprecated in io-package.json. Please remove from io-package.json.
// [159] common.dependencies "js-controller" dependency should always allow future versions (>=x.x.x) - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}
// [160] "admin" is not allowed in common.dependencies
// [161] "js-controller" is not allowed in common.globalDependencies
// [162] js-controller dependency missing. js-controller ${requiredJsControllerVersion} is required as minimum, ${recommendedJsControllerVersion} is recommended. Please add to dependencies at io-package.json.
// [163] common.mode "${context.ioPackageJson.common.mode}" requires JavaScript file for "main" in package.json
// [164] onlyWWW should have common.mode "none" in io-package.json
// [165] "common.mode" not found in io-package.json
// [166] "common.mode: ${context.ioPackageJson.common.mode}" is unknown in io-package.json.
// [167] scheduled adapters must have "common.schedule" property in io-package.json
// [168] "common.keywords" should not contain "${forbiddenKeywords.join(', ')}" io-package.json0
// [169] "common.keywords" must be an array within io-package.json and contain some useful keywords
// [169] "common.keywords" must be an array within io-package.json and contain some useful keywords
// [169] "common.keywords" must be an array within io-package.json and contain some useful keywords
// [170] "common.licenseInformation.type" is invalid. Select valid type (e.g. free)
// [171] "common.licenseInformation.link" is required for non-free adapters
// [172] "common.localLink" in io-package.json is deprecated. Please define object "common.localLinks": { "_default": "..." }
// [173] Potential sensitive data "${missingProtected.join()}" not listed at "protectedNative" in io-package.json
// [173] Potential sensitive data "${suspiciousKeys.join()}" not listed at "protectedNative" in io-package.json
// [174] Potential sensitive data "${missingProtected.join()}" not listed at "encryptedNative" in io-package.json
// [174] Potential sensitive data "${suspiciousKeys.join()}" not listed at "encryptedNative" in io-package.json
// [175] Release "${version}" at "common.news" in io-package.json is malformed.
// [176] Own adapter is not allowed to be listed at "common.restartAdapters" in io-package.json
// [177] "common.main" is deprecated in io-package.json. For js-controller >= 3.3 please use package.json main and remove "common.main" from io-package.json.
// [178] "common.materialize" is deprecated in io-package.json. For admin version >= 5 please use the property "common.adminUI"
// [179] "common.materializeTab" is deprecated in io-package.json. For admin version >= 5 please use the property "common.adminUI".
// [180] "common.noConfig" is deprecated in io-package.json.  For admin version >= 5 please use "common.adminUI.config":"none".
// [181] "common.license" in io-package.json is deprecated. Please define object "common.licenseInformation"
// [182] Please remove "common.license" from io-package.json as "common.licenseInformation" is declared.
// [183] "common.licenseInformation.license" is missing
// [184] ${blacklistIOPackageJson[blacklist].msg}
// [184] ${blacklistIOPackageJson[blacklist].msg}
// [185] "common.dependencies" must be an array at io-package.json
// [186] "common.globalDependencies" must be an array at io-package.json
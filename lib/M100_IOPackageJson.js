'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   io-package.json
    Numbering   :   100 - 199, 200 - 249

*/

const compareVersions = require('compare-versions');
const sizeOf = require('image-size');

const common = require('./common.js');

async function getIOPackageJson(context) {
    console.log('[init] getting io-package.json');

    const ioPackageJson = await common.getFile(context, '/io-package.json');
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

const recommendedJsControllerVersion = '6.0.11';
let requiredJsControllerVersion = '5.0.19';

const recommendedAdminVersion = '7.6.17';
let requiredAdminVersion = '6.17.14'; // set to 6.17.14 if jsonConfig is used

const blacklistIOPackageJson = {
    $schema: {
        msg: 'Please remove "$schema" from io-package.json. You may set schema at your IDE to add edit-support.',
        err: true,
    },
    installedFrom: {
        msg: '"installedFrom" is invalid at io-package.json. Please remove.',
        err: true,
    },
    'common.installedFrom': {
        msg: '"common.installedFrom" is invalid. Please remove from io-package.json.',
        err: true,
    },
    'common.main': {
        msg: '"common.main" is deprecated and ignored. Please remove from io-package.json. Executable is defined by entry "main" at package.json.',
        err: false,
    },
    // 'common.materialize': {
    //     msg: '"common.materialize" is deprecated for admin >= 5 at io-package.json. Please use property "adminUI".',
    //     err: false,
    // },
    // 'common.materializeTab': {
    //     msg: '"common.materializeTab" is deprecated for admin >= 5 at io-package.json. Please use property "adminUI".',
    //     err: false,
    // },
    'common.noConfig': {
        msg: '"common.noConfig" is deprecated for admin >= 5 at io-package.json. Please use property "adminUI.config":"none".',
        err: false,
    },
    'common.nondeletable': {
        msg: '"common.nondeleteable" detected at io-package.json. Please check why this adapter cannot be deleted or updated and remove flag if possible.',
        err: false,
    },
    'common.singleton': {
        msg: '"common.singleton" detected for non onlyWWW adapter. Is this really desired?',
        err: false,
        suggestion: true,
        condition: {
            onlyWWW: false,
        },
    },
    'common.singletonHost': {
        msg: '"common.singletonHost" detected for non onlyWWW adapter. Is this really desired?',
        err: false,
        suggestion: true,
        condition: {
            onlyWWW: false,
        },
    },
    'common.subscribe': {
        msg: '"common.subscribe" will be removed with js-controller >= 6. Please remove from io-package.json and adapt code if required.',
        err: true,
    },
    'common.title': {
        msg: '"common.title" is deprecated and replaced by "common.titleLang". Please remove from io-package.json.',
        err: false,
    },
    'common.wakeup': {
        msg: '"common.wakeup" is deprecated and ignored. Please remove from io-package.json.',
        err: true,
    },
};

async function checkIOPackageJson(context) {
    console.log('\n[E100 - E249] checking io-package.json');

    if (!context.ioPackageJson.native) {
        context.errors.push('[E101] io-package.json must have at least empty "native" attribute');
    } else {
        context.checks.push('"native" found in io-package.json');

        // Generic check for potential credentials that should have a counterpart in encryptedNative/protectedNative
        const suspiciousPhrases = [
            '^.*api.?key$',
            '^.*credential$',
            '^pass$',
            '^.*passwd$',
            '^.*password$',
            '^.*passwort$',
            '^.*pin$',
            '^private.*',
            '^private_pw$',
            '^psk$',
            '^pwd$',
            '^.*secret$',
            '^.*token$',
        ];

        // let suspiciousKeys = Object.keys(context.ioPackageJson.native) || [];
        // suspiciousKeys = suspiciousKeys.filter(key => suspiciousPhrases.includes(key.toLowerCase()));

        const regex = new RegExp(suspiciousPhrases.join('|'), 'i');
        const nativeKeys = Object.keys(context.ioPackageJson.native) || [];

        let suspiciousKeys = nativeKeys.filter(key => regex.test(key.toLowerCase()));
        common.debug(`Suspicious key test: native: ${nativeKeys}`);
        common.debug(`Suspicious key test: suspiciousKeys (unfiltered): ${suspiciousKeys}`);
        if (suspiciousKeys.length) {
            suspiciousKeys = suspiciousKeys.filter(key => typeof context.ioPackageJson.native[key] !== 'boolean');
            common.debug(`Suspicious key test: suspiciousKeys (filtered): ${suspiciousKeys}`);
        }
        if (suspiciousKeys.length) {
            if (context.ioPackageJson.protectedNative) {
                const missingProtected = suspiciousKeys.filter(
                    key =>
                        !(context.ioPackageJson.protectedNative && context.ioPackageJson.protectedNative.includes(key)),
                );
                if (missingProtected.length) {
                    context.warnings.push(
                        `[W173] Potential sensitive data "${missingProtected.join()}" not listed at "protectedNative" in io-package.json`,
                    );
                }
            } else {
                context.warnings.push(
                    `[W173] Potential sensitive data "${suspiciousKeys.join()}" not listed at "protectedNative" in io-package.json`,
                );
            }

            if (context.ioPackageJson.encryptedNative) {
                const missingProtected = suspiciousKeys.filter(
                    key =>
                        !(context.ioPackageJson.encryptedNative && context.ioPackageJson.encryptedNative.includes(key)),
                );
                if (missingProtected.length) {
                    context.warnings.push(
                        `[W174] Potential sensitive data "${missingProtected.join(', ')}" not listed at "encryptedNative" in io-package.json`,
                    );
                }
            } else {
                context.warnings.push(
                    `[W174] Potential sensitive data "${suspiciousKeys.join(', ')}" not listed at "encryptedNative" in io-package.json`,
                );
            }
        }

        let valid = true;
        if (context.ioPackageJson.encryptedNative && !Array.isArray(context.ioPackageJson.encryptedNative)) {
            context.errors.push(`[E198] "encryptedNative" must be an array at io-package.json`);
            valid = false;
        }

        if (context.ioPackageJson.protectedNative && !Array.isArray(context.ioPackageJson.protectedNative)) {
            context.errors.push(`[E199] "protectedNative" must be an array at io-package.json`);
            valid = false;
        }

        if (valid) {
            for (const key of context.ioPackageJson.encryptedNative || []) {
                if (!(context.ioPackageJson.protectedNative && context.ioPackageJson.protectedNative.includes(key))) {
                    context.warnings.push(
                        `[W193] Encrypted native "${key}" should be listed at "protectedNative" in io-package.json`,
                    );
                }
            }

            for (const key of context.ioPackageJson.protectedNative || []) {
                if (!(context.ioPackageJson.encryptedNative && context.ioPackageJson.encryptedNative.includes(key))) {
                    context.warnings.push(
                        `[S194] Consider adding protected native "${key}" to "encryptedNative" in io-package.json`,
                    );
                }
            }

            for (const key of [
                ...new Set([
                    ...(context.ioPackageJson.protectedNative || []),
                    ...(context.ioPackageJson.encryptedNative || []),
                ]),
            ]) {
                if (context.ioPackageJson.native[key] === undefined) {
                    // Check if the key contains a dot, indicating an array element path
                    if (key.includes('.')) {
                        context.warnings.push(`[W203] Encryption of array elements "${key}" is not yet available`);
                    } else {
                        context.warnings.push(
                            `[W195] Protected or encrypted element "${key}" should be listed at "native" in io-package.json`,
                        );
                    }
                }
            }
        } // if (valid)
    }

    if (!context.ioPackageJson.common) {
        context.errors.push('[E102] io-package.json must have common object');
        return context;
    }
    context.checks.push('"common" found in io-package.json');

    if (!context.ioPackageJson.common.name || context.ioPackageJson.common.name !== context.adapterName.toLowerCase()) {
        context.errors.push(
            `[E103] "common.name" in io-package.json must be equal to "${context.adapterName.toLowerCase()}'". Now is ${context.ioPackageJson.common.name}`,
        );
    } else {
        context.checks.push('"common.name" is valid in io-package.json');
    }

    if (context.ioPackageJson.common.materialize) {
        if (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config) {
            context.warnings.push(
                '[W187] "common.materialize" replaced by property "common.adminUI.config" at io-package.json. Please remove.',
            );
        } else {
            context.warnings.push(
                '[W178] "common.materialize" is deprecated for admin >= 5 at io-package.json. Please use property "common.adminUI.config".',
            );
        }
    } else {
        context.checks.push('"common.materialize" does not exist in io-package.json');
    }

    if (context.ioPackageJson.common.materializeTab) {
        if (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.tab) {
            context.warnings.push(
                '[W188] "common.materializeTab" replaced by property "common.adminUI.tab" at io-package.json. Please remove.',
            );
        } else {
            context.warnings.push(
                '[W179] "common.materializeTab" is deprecated for admin >= 5 at io-package.json. Please use property "common.adminUI.tab".',
            );
        }
    } else {
        context.checks.push('"common.materializeTab" does not exist in io-package.json');
    }

    if (!context.ioPackageJson.common.titleLang) {
        context.errors.push('[E104] No "common.titleLang" found in io-package.json');
    } else {
        context.checks.push('"common.titleLang" found in io-package.json');

        if (typeof context.ioPackageJson.common.titleLang !== 'object') {
            context.errors.push(
                `[E105] "common.titleLang" must be an object. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}`,
            );
        } else {
            let missingLang = common.checkLanguages(
                context.ioPackageJson.common.titleLang,
                context.cfg.requiredLanguages,
            );
            if (missingLang.length) {
                context.errors.push(
                    `[E126] Missing mandatory translation into ${missingLang.join()} of "common.titleLang" in io-package.json.`,
                );
            }

            missingLang = common.checkLanguages(context.ioPackageJson.common.titleLang, context.cfg.allowedLanguages);
            missingLang = missingLang.filter(lang => !context.cfg.requiredLanguages.includes(lang));
            if (missingLang.length) {
                missingLang = [...new Set(missingLang)]; // make unique
                context.warnings.push(
                    `[W127] Missing suggested translation into ${missingLang.join()} of "common.titleLang" in io-package.json.`,
                );
            }
        }

        Object.keys(context.ioPackageJson.common.titleLang).forEach(lang => {
            const text = context.ioPackageJson.common.titleLang[lang];
            if (text.match(/iobroker/i)) {
                context.errors.push(
                    `[E106] "common.titleLang" must not have ioBroker in the name. It is clear, for what this adapter was created. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}`,
                );
            } else {
                context.checks.push('"common.titleLang" has no ioBroker in it in io-package.json');
            }

            if (text.match(/\sadapter|adapter\s/i)) {
                context.warnings.push(
                    `[W128] "common.titleLang" should not contain word "adapter" in the name. It is clear, that this is adapter. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}`,
                );
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

    // TODO - check format of version to be xx.xx.xx[-text.nn]

    if (!context.ioPackageJson.common.desc) {
        context.errors.push('[E108] No "common.desc" found in io-package.json');
    } else {
        context.checks.push('"common.desc" found in io-package.json');

        if (typeof context.ioPackageJson.common.desc !== 'object') {
            context.errors.push(
                `[E109] "common.desc" in io-package.json must be an object for many languages. Found only "${context.ioPackageJson.common.desc}"`,
            );
        } else {
            let missingLang = common.checkLanguages(context.ioPackageJson.common.desc, context.cfg.requiredLanguages);
            if (missingLang.length) {
                context.errors.push(
                    `[E133] Missing mandatory translation into ${missingLang.join()} of "common.desc" in io-package.json.`,
                );
            }

            missingLang = common.checkLanguages(context.ioPackageJson.common.desc, context.cfg.allowedLanguages);
            missingLang = missingLang.filter(lang => !context.cfg.requiredLanguages.includes(lang));
            if (missingLang.length) {
                missingLang = [...new Set(missingLang)]; // make unique
                context.warnings.push(
                    `[W134] Missing suggested translation into ${missingLang.join()} of "common.desc" in io-package.json.`,
                );
            }
        }
    }

    // TODO - report unknown languages

    if (!context.ioPackageJson.common.keywords) {
        context.errors.push(
            '[E169] "common.keywords" must be an array within io-package.json and contain some useful keywords',
        );
    } else {
        const forbiddenKeywords = ['iobroker', 'adapter', 'smart home'];
        if (!Array.isArray(context.ioPackageJson.common.keywords)) {
            context.errors.push(
                '[E169] "common.keywords" must be an array within io-package.json and contain some useful keywords',
            );
        } else if (context.ioPackageJson.common.keywords.length === 0) {
            context.errors.push(
                '[E169] "common.keywords" must be an array within io-package.json and contain some useful keywords',
            );
        } else if (
            forbiddenKeywords.filter(keyword =>
                context.ioPackageJson.common.keywords.map(k => k.toLowerCase()).includes(keyword),
            ).length > 0
        ) {
            context.warnings.push(
                `[W168] "common.keywords" should not contain "${forbiddenKeywords.join(', ')}" io-package.json`,
            );
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
            context.errors.push('[E112] extIcon must be the same as an icon but with github path.');
        } else {
            context.checks.push('"common.extIcon" has same path as repo in io-package.json.');
        }
    }

    if (!context.ioPackageJson.common.compact && !context.ioPackageJson.common.onlyWWW) {
        if (context.ioPackageJson.common.compact === undefined) {
            context.warnings.push(
                '[W113] Please test whether adapter can support compact mode, if not set "common.compact:false" at io-package.json.',
            );
        } else {
            context.warnings.push('[S139] Please evaluate whether adapter can be modified to support compact mode.');
        }
    } else if (!context.ioPackageJson.common.onlyWWW) {
        context.checks.push('"common.compact" found in io-package.json');
    }

    // TODO compact ignored for onlyWW and so it cpould be suggested to be removed

    if (
        context.ioPackageJson.common.noConfig &&
        context.ioPackageJson.common.adminUI &&
        context.ioPackageJson.common.adminUI.config !== 'none'
    ) {
        context.errors.push('[E114] "common.noConfig=true" requires "common.adminUI.config" to be set to "none"');
    }
    if (
        !context.ioPackageJson.common.materialize &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'json') &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'materialize') &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'html') &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'none')
    ) {
        context.errors.push(
            '[E129] Admin support not specified. Please add "common.adminUI.config = json|materialize|html|none"',
        );
    } else {
        context.checks.push('"common.materialize" or valid "common.adminUI.config:xxx" found in io-package.json');
    }

    if (context.ioPackageJson.common.license) {
        context.warnings.push(
            '[W181] "common.license" in io-package.json is deprecated. Please define object "common.licenseInformation"',
        );
    }

    if (!context.ioPackageJson.common.licenseInformation) {
        if (!context.ioPackageJson.common.license) {
            context.errors.push('[E115] "common.licenseInformation" not found in io-package.json');
        }
    } else {
        context.checks.push('"common.licenseInformation" found in io-package.json');

        if (context.ioPackageJson.common.license) {
            context.errors.push(
                '[E182] Please remove "common.license" from io-package.json as "common.licenseInformation" is declared.',
            );
        }

        // check if license valid
        if (!context.ioPackageJson.common.licenseInformation.license) {
            context.errors.push('[E183] "common.licenseInformation.license" is missing');
        } else if (!context.cfg.allowedLicenses.includes(context.ioPackageJson.common?.licenseInformation?.license)) {
            context.errors.push(
                '[E116] No SPDX license found at "common.licenseInformation". Please use one of listed here: https://spdx.org/licenses/',
            );
        } else {
            context.checks.push('"common.licenseInformation" is valid in io-package.json');
        }

        // check if type is valid
        if (
            !['free', 'paid', 'commercial', 'limited'].includes(context.ioPackageJson.common?.licenseInformation?.type)
        ) {
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

        if (
            !context.packageJson ||
            context.ioPackageJson.common?.licenseInformation?.license !== context.packageJson.license
        ) {
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
            context.errors.push(
                `[E166] "common.mode: ${context.ioPackageJson.common.mode}" is unknown in io-package.json.`,
            );
        } else {
            context.checks.push('"common.mode" has known mode in io-package.json');

            if (context.ioPackageJson.common.onlyWWW && context.ioPackageJson.common.mode !== 'none') {
                context.errors.push('[E164] onlyWWW should have common.mode "none" in io-package.json');
            }

            if (context.ioPackageJson.common.mode === 'schedule' && !context.ioPackageJson.common.schedule) {
                context.errors.push(
                    '[E167] scheduled adapters must have "common.schedule" property in io-package.json',
                );
            }

            if (
                context.ioPackageJson.common.mode === 'extension' &&
                !context.ioPackageJson.common.dependencies.find(dep => Object.keys(dep).find(attr => attr === 'web'))
            ) {
                context.errors.push('[E192] extension adapters must list web adapter as dependency in io-package.json');
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
        context.warnings.push(
            '[W172] "common.localLink" in io-package.json is deprecated. Please define object "common.localLinks": { "_default": "..." }',
        );
    } else {
        context.checks.push('No "common.localLink" found in io-package.json');
    }

    if (!context.ioPackageJson.common.news) {
        context.errors.push('[E130] No "common.news" found in io-package.json');
    } else {
        context.checks.push('"common.news" found in io-package.json');

        if (Object.keys(context.ioPackageJson.common.news).length > 20) {
            context.errors.push(
                '[E131] Too many "common.news" found in io-package.json. Must be less than 20. Please remove old news.',
            );
        } else if (Object.keys(context.ioPackageJson.common.news).length > 7) {
            context.warnings.push(
                '[W132] Many "common.news" found in io-package.json. Repository builder will truncate at 7 news. Please remove old news.',
            );
        }

        Object.keys(context.ioPackageJson.common.news).forEach(version => {
            if (!compareVersions.validateStrict(version)) {
                context.errors.push(`[E175] Release "${version}" at "common.news" in io-package.json is malformed.`);
            }
        });

        if (!context.ioPackageJson.common.news[context.ioPackageJson.common.version]) {
            context.errors.push(
                `[E136] No "common.news" found for actual version ${context.ioPackageJson.common.version} in io-package.json`,
            );
        }

        let missingLang = [];
        Object.keys(context.ioPackageJson.common.news).forEach(version => {
            missingLang = missingLang.concat(
                common.checkLanguages(context.ioPackageJson.common.news[version], context.cfg.requiredLanguages),
            );
        });
        if (missingLang.length) {
            missingLang = [...new Set(missingLang)]; // make unique
            context.errors.push(
                `[E145] Missing mandatory translation into ${missingLang.join()} of some "common.news" in io-package.json.`,
            );
        }

        missingLang = [];
        Object.keys(context.ioPackageJson.common.news).forEach(version => {
            missingLang = missingLang.concat(
                common.checkLanguages(context.ioPackageJson.common.news[version], context.cfg.allowedLanguages),
            );
        });
        missingLang = missingLang.filter(lang => !context.cfg.requiredLanguages.includes(lang));
        if (missingLang.length) {
            missingLang = [...new Set(missingLang)]; // make unique
            context.warnings.push(
                `[W154] Missing suggested translation into ${missingLang.join()} of some "common.news" in io-package.json.`,
            );
        }
    }

    // check main entry
    if (context.ioPackageJson.common.mode !== 'none' && context.ioPackageJson.common.mode !== 'extension') {
        if (!context.packageJson.main) {
            !context.ioPackageJson.common.onlyWWW && context.errors.push('[E143] No main found in the package.json');
        } else {
            context.checks.push('"main" found in package.json');
            if (!context.packageJson.main.endsWith('.js') && !context.packageJson.main.endsWith('.ts')) {
                !context.ioPackageJson.common.onlyWWW &&
                    context.errors.push(
                        `[E163] common.mode "${context.ioPackageJson.common.mode}" requires JavaScript or Typescript file for "main" in package.json`,
                    );
            } else {
                context.checks.push('"main" references .js or .ts file');
            }
        }
    }

    if (context.ioPackageJson.instanceObjects) {
        const instanceObjects = context.ioPackageJson.instanceObjects;
        if (!(instanceObjects instanceof Array)) {
            context.errors.push('[E146] instanceObjects must be an Array in io-package.json');
        } else {
            const allowedObjectTypes = [
                'state',
                'channel',
                'device',
                'enum',
                'host',
                'adapter',
                'instance',
                'meta',
                'config',
                'script',
                'user',
                'group',
                'chart',
                'folder',
            ];
            const allowedStateTypes = ['number', 'string', 'boolean', 'array', 'object', 'mixed', 'file', 'json'];

            instanceObjects.forEach(instanceObject => {
                if (instanceObject.type !== undefined && !allowedObjectTypes.includes(instanceObject.type)) {
                    context.errors.push(`[E147] instanceObject type has an invalid type: ${instanceObject.type}`);
                }

                if (instanceObject.common) {
                    if (instanceObject.common.type !== undefined) {
                        if (typeof instanceObject.common.type !== 'string') {
                            context.errors.push(
                                `[E148] instanceObject common.type has an invalid type! Expected "string", received  "${typeof instanceObject.common.type}"`,
                            );
                        }

                        if (
                            instanceObject.type === 'state' &&
                            !allowedStateTypes.includes(instanceObject.common.type)
                        ) {
                            context.errors.push(
                                `[E149] instanceObject common.type has an invalid value: ${instanceObject.common.type}`,
                            );
                        }
                    }
                }
            });
        }
    }

    if (!context.ioPackageJson.common.connectionType) {
        !context.ioPackageJson.common.onlyWWW &&
            context.errors.push('[E150] No "common.connectionType" found in io-package.json');
    } else if (!['local', 'cloud', 'none'].includes(context.ioPackageJson.common.connectionType)) {
        context.errors.push(
            `[E151] "common.connectionType" type has an invalid value "${context.ioPackageJson.common.connectionType}"`,
        );
    }

    if (!context.ioPackageJson.common.dataSource) {
        !context.ioPackageJson.common.onlyWWW &&
            context.errors.push('[E152] No "common.dataSource" found in io-package.json');
    } else if (!['poll', 'push', 'assumption', 'none'].includes(context.ioPackageJson.common.dataSource)) {
        context.errors.push(
            `[E153] "common.dataSource" type has an invalid value "${context.ioPackageJson.common.dataSource}"`,
        );
    }

    if (context.ioPackageJson.common.supportsCustoms) {
        if (!context.ioPackageJson.common.adminUI?.custom && context.ioPackageJson.common.adminUI?.custom !== 'json') {
            context.errors.push(`[E196] "common.supportCustoms" requires "common.adminUI.custom" to be defined`);
        } else {
            context.checks.push('"support.customs" is set and "adminUI.custom" requires "json"');
        }
    } else {
        context.checks.push('"support.customs" is not set');
    }

    // check js-controller dependency
    let currentJsControllerVersion = undefined;
    if (context.ioPackageJson.common.dependencies) {
        if (!(context.ioPackageJson.common.dependencies instanceof Array)) {
            context.errors.push(`[E185] "common.dependencies" must be an array at io-package.json`);
        } else {
            // Check for empty dependency objects
            const emptyDependencies = context.ioPackageJson.common.dependencies.filter(
                dep => typeof dep === 'object' && dep !== null && Object.keys(dep).length === 0,
            );
            if (emptyDependencies.length > 0) {
                context.errors.push(
                    `[E200] Empty dependency objects found in "common.dependencies" at io-package.json. Please remove empty objects.`,
                );
            }

            const dependencyArray = common.getDependencyArray(context.ioPackageJson.common.dependencies);

            // Admin is not allowed in dependencies (globalDependencies only)
            if (dependencyArray.includes('admin')) {
                context.errors.push(`[E160] "admin" is not allowed in common.dependencies`);
            }

            const jsControllerDependency = context.ioPackageJson.common.dependencies.find(dep =>
                Object.keys(dep).find(attr => attr === 'js-controller'),
            );
            if (jsControllerDependency) {
                common.debug(`Found current js-controller dependency "${jsControllerDependency['js-controller']}"`);

                if (!jsControllerDependency['js-controller'].startsWith('>=')) {
                    context.errors.push(
                        `[E159] common.dependencies "js-controller" dependency should always allow future versions (>=x.x.x) - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}.`,
                    );
                } else {
                    currentJsControllerVersion = jsControllerDependency['js-controller'].replace(/[^\d.]/g, '');
                }
            } else {
                if (!context.ioPackageJson.common.onlyWWW) {
                    if (requiredJsControllerVersion !== recommendedJsControllerVersion) {
                        context.errors.push(
                            `[E162] js-controller dependency missing. js-controller ${requiredJsControllerVersion} is required as minimum, ${recommendedJsControllerVersion} is recommended. Please add to dependencies at io-package.json.`,
                        );
                    } else {
                        context.errors.push(
                            `[E162] js-controller dependency missing. js-controller ${requiredJsControllerVersion} is required as minimum. Please add to dependencies at io-package.json.`,
                        );
                    }
                }
            }
        }
    } else {
        if (!context.ioPackageJson.common.onlyWWW) {
            context.errors.push(`[E185] "common.dependencies" must be an array at io-package.json`);
            if (requiredJsControllerVersion !== recommendedJsControllerVersion) {
                context.errors.push(
                    `[E162] js-controller dependency missing. js-controller ${requiredJsControllerVersion} is required as minimum, ${recommendedJsControllerVersion} is recommended. Please add to dependencies at io-package.json.`,
                );
            } else {
                context.errors.push(
                    `[E162] js-controller dependency missing. js-controller ${requiredJsControllerVersion} is required as minimum. Please add to dependencies at io-package.json.`,
                );
            }
        }
    }

    //
    // increase dependency as required by addition features
    //
    if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.supportedMessges) {
        requiredJsControllerVersion = common.maxVersion(requiredJsControllerVersion, '5.0.18');
    }
    if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.nodeProcessParams) {
        requiredJsControllerVersion = common.maxVersion(requiredJsControllerVersion, '5.0.18');
    }

    if (
        currentJsControllerVersion &&
        compareVersions.compare(requiredJsControllerVersion, currentJsControllerVersion, '>')
    ) {
        if (requiredJsControllerVersion !== recommendedJsControllerVersion) {
            context.errors.push(
                `[E157] js-controller ${currentJsControllerVersion} listed as dependency but ${requiredJsControllerVersion} is required as minimum, ${recommendedJsControllerVersion} is recommended. Please update dependency at io-package.json.`,
            );
        } else {
            context.errors.push(
                `[E157] js-controller ${currentJsControllerVersion} listed as dependency but ${requiredJsControllerVersion} is required as minimum. Please update dependency at io-package.json.`,
            );
        }
    } else if (
        currentJsControllerVersion &&
        compareVersions.compare(recommendedJsControllerVersion, currentJsControllerVersion, '>')
    ) {
        context.warnings.push(
            `[W156] js-controller ${currentJsControllerVersion} listed as dependency but ${recommendedJsControllerVersion} is recommended. Please consider updating dependency at io-package.json.`,
        );
    }

    // check admin dependency
    let requireAdmin =
        // some config is present and does not state 'none'
        context.ioPackageJson.common.materialize ||
        context.ioPackageJson.common.materializeTab ||
        (context.ioPackageJson.common.adminUI?.config && context.ioPackageJson.common.adminUI?.config !== 'none') ||
        (context.ioPackageJson.common.adminUI?.custom && context.ioPackageJson.common.adminUI?.custom !== 'none') ||
        (context.ioPackageJson.common.adminUI?.tab && context.ioPackageJson.common.adminUI?.tab !== 'none') ||
        // or its pure old html without any setting
        (!context.ioPackageJson.common.materialize &&
            !context.ioPackageJson.common.materializeTab &&
            !context.ioPackageJson.common.adminUI?.config &&
            !context.ioPackageJson.common.adminUI?.custom &&
            !context.ioPackageJson.common.adminUI?.tab);
    common.debug(`admin dependency is ${requireAdmin ? '' : 'not'}required`);

    if (context.cfg.hasJsonConfig) {
        requiredAdminVersion = common.maxVersion(requiredAdminVersion, '6.17.14');
    }

    let currentAdminVersion = undefined;
    if (context.ioPackageJson.common.globalDependencies) {
        if (!(context.ioPackageJson.common.globalDependencies instanceof Array)) {
            context.errors.push(`[E186] "common.globalDependencies" must be an array at io-package.json`);
        } else {
            // Check for empty dependency objects
            const emptyGlobalDependencies = context.ioPackageJson.common.globalDependencies.filter(
                dep => typeof dep === 'object' && dep !== null && Object.keys(dep).length === 0,
            );
            if (emptyGlobalDependencies.length > 0) {
                context.errors.push(
                    `[E201] Empty dependency objects found in "common.globalDependencies" at io-package.json. Please remove empty objects.`,
                );
            }

            const dependencyArray = common.getDependencyArray(context.ioPackageJson.common.globalDependencies);

            // js-controller is not allowed in global dependencies (dependencies only)
            if (dependencyArray.includes('js-controller')) {
                context.errors.push(`[E161] "js-controller" is not allowed in common.globalDependencies`);
            }

            const adminDependency = context.ioPackageJson.common.globalDependencies.find(dep =>
                Object.keys(dep).find(attr => attr === 'admin'),
            );
            if (adminDependency) {
                common.debug(`Found current admin dependency "${adminDependency['js-controller']}"`);

                if (!adminDependency['admin'].startsWith('>=')) {
                    context.errors.push(
                        `[E189] common.dependencies "admin" dependency should always allow future versions (>=x.x.x) - recommended: {"admin": ">=${recommendedAdminVersion}"}.`,
                    );
                } else {
                    currentAdminVersion = adminDependency['admin'].replace(/[^\d.]/g, '');
                }
                if (!requireAdmin) {
                    context.errors.push(
                        `[S191] admin dependency (${adminDependency['admin']}) at io-package.json is not required as 'common.adminUI' specifies that no UI exists. Feel free to remove.`,
                    );
                }
            } else {
                if (requireAdmin) {
                    if (requiredAdminVersion !== recommendedAdminVersion) {
                        context.errors.push(
                            `[E190] admin dependency missing. admin ${requiredAdminVersion} is required as minimum, ${recommendedAdminVersion} is recommended. Please add to globalDependencies at io-package.json.`,
                        );
                    } else {
                        context.errors.push(
                            `[E190] admin dependency missing. admin ${requiredAdminVersion} is required as minimum. Please add to globalDependencies at io-package.json.`,
                        );
                    }
                }
            }
        }
    } else {
        if (requireAdmin) {
            // context.errors.push(`[E186] "common.globalDependencies" must be an array at io-package.json`);
            if (requiredAdminVersion !== recommendedAdminVersion) {
                context.errors.push(
                    `[E190] admin dependency missing. admin ${requiredAdminVersion} is required as minimum, ${recommendedAdminVersion} is recommended. Please add to globalDependencies at io-package.json.`,
                );
            } else {
                context.errors.push(
                    `[E190] admin dependency missing. admin ${requiredAdminVersion} is required as minimum. Please add to globalDependencies at io-package.json.`,
                );
            }
        }
    }

    if (currentAdminVersion && compareVersions.compare(requiredAdminVersion, currentAdminVersion, '>')) {
        if (requiredAdminVersion !== recommendedAdminVersion) {
            context.errors.push(
                `[E157] admin ${currentAdminVersion} listed as dependency but ${requiredAdminVersion} is required as minimum, ${recommendedAdminVersion} is recommended. Please update globalDependency at io-package.json.`,
            );
        } else {
            context.errors.push(
                `[E157] admin ${currentAdminVersion} listed as dependency but ${requiredAdminVersion} is required as minimum. Please update globalDependency at io-package.json.`,
            );
        }
    } else if (currentAdminVersion && compareVersions.compare(recommendedAdminVersion, currentAdminVersion, '>')) {
        context.warnings.push(
            `[W156] admin ${currentAdminVersion} listed as dependency but ${recommendedAdminVersion} is recommended. Please consider updating globalDependency at io-package.json.`,
        );
    } else {
        if (requireAdmin) {
            context.checks.push('"admin" dependendy satisfied');
        } else {
            context.checks.push('"admin" dependendy not required');
        }
    }

    if (!context.ioPackageJson.common.onlyWWW) {
        if (!context.ioPackageJson.common.tier) {
            context.warnings.push(
                `[W135] "common.tier" is required in io-package.json. Please check https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#adapter.`,
            );
        } else if (![1, 2, 3].includes(context.ioPackageJson.common.tier)) {
            context.errors.push(
                `[E155] Invalid "common.tier" value: ${context.ioPackageJson.common.tier} at io-package.json. Only 1, 2 or 3 are allowed!`,
            );
        } else {
            context.checks.push('"common.tier" is valid in io-package.json');
        }
    } else {
        context.checks.push('"common.tier" check skipped for wwwOnly adapter.');
    }

    if (context.ioPackageJson.common.automaticUpgrade) {
        context.errors.push(
            `[E137] "common.automaticUpgrade" will be defined by the user. Please remove from io-package.json`,
        );
    } else {
        context.checks.push('"common.automaticUpgrade" does not exist in io-package.json');
    }

    if (context.ioPackageJson.common.restartAdapters) {
        const restartAdaptersArray = context.ioPackageJson.common.restartAdapters;

        // own adapter is not allowed in a restart array
        if (restartAdaptersArray.includes(context.ioPackageJson.common.name)) {
            context.errors.push(
                `[E176] Own adapter is not allowed to be listed at "common.restartAdapters" in io-package.json`,
            );
        } else {
            context.checks.push('Own adapter not listed at "common.restartAdapters".');
        }

        // suggest to restart 'vis-2' if 'vis' is in restart list
        if (restartAdaptersArray.includes('vis') && !restartAdaptersArray.includes('vis-2')) {
            context.warnings.push(
                `[S202] Consider adding 'vis-2' to "common.restartAdapters" as 'vis' is already listed in io-package.json`,
            );
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
            // console.log(`   check ${log}`);
            tmp = tmp[element];
            if (!tmp) {
                // console.log(`   ${log} does not exist`);
                break;
            }
        }
        if (tmp) {
            if (blacklistIOPackageJson[blacklist].condition) {
                for (const condition in blacklistIOPackageJson[blacklist].condition) {
                    // console.log(
                    //     `   check condition "${condition}": ${blacklistIOPackageJson[blacklist].condition[condition]}`,
                    // );
                    if (condition === 'onlyWWW') {
                        if (context.cfg.onlyWWW !== blacklistIOPackageJson[blacklist].condition[condition]) {
                            // console.log(`    check failed`);
                            // console.log(`    ${context.ioPackageJson.common.onlyWWW}`);
                            // console.log(`    ${onlyWWW}`);
                            // console.log(`    ${blacklistIOPackageJson[blacklist].condition[condition]}`);
                            tmp = undefined;
                        }
                    }
                }
            }
        }
        if (tmp) {
            if (blacklistIOPackageJson[blacklist].err) {
                context.errors.push(`[E184] ${blacklistIOPackageJson[blacklist].msg}`);
            } else if (blacklistIOPackageJson[blacklist].suggestion) {
                context.warnings.push(`[S184] ${blacklistIOPackageJson[blacklist].msg}`);
            } else {
                context.warnings.push(`[W184] ${blacklistIOPackageJson[blacklist].msg}`);
            }
        }
    }
    context.checks.push('blacklist for io-package.json checked.');

    if (context.ioPackageJson.common.extIcon) {
        let icon = null;
        try {
            if (common.isLocal()) {
                const url = context.ioPackageJson.common.extIcon.replace(context.githubUrl, '');
                icon = await common.getFile(null, url, true); // TO BE ADAPTED
            } else {
                icon = await common.downloadURL(context.ioPackageJson.common.extIcon, true);
            }
            context.checks.push('"extIcon" could be downloaded');
            //console.log(icon);
        } catch (e) {
            common.debug(e);
            context.errors.push(`[E125] External icon not found under URL: ${context.ioPackageJson.common.extIcon}`);
            icon = null;
        }
        if (icon) {
            try {
                // @ts-expect-error sizeOf does not have typing
                const image = sizeOf(icon);
                common.debug(
                    `logo ${context.ioPackageJson.common.icon} width: ${image.width}, height: ${image.height}`,
                );
                if (image.width !== image.height) {
                    context.errors.push(
                        '[E140] width and height of logo (specified at "common.extIcon") are not equal',
                    );
                } else {
                    context.checks.push('width and height of "extIcon" logo are equal');
                    if (image.width < 32) {
                        context.errors.push(
                            '[E141] logo (specified at "common.extIcon") is too small. It must be greater or equal than 32x32',
                        );
                    } else if (image.width > 512) {
                        context.errors.push(
                            '[E142] logo (specified at "common.extIcon") is too big. It must be less or equal than 512x512',
                        );
                    } else {
                        context.checks.push('"extIcon" logo is of correct size');
                    }
                }
            } catch (e) {
                common.debug(e);
                context.errors.push(`[E197] External icon ${context.ioPackageJson.common.extIcon} cannot be parsed`);
            }
        }
    }

    if (!context.ioPackageJson.common.onlyWWW && context.packageJson.main) {
        try {
            await common.getFile(context, `/${context.packageJson.main}`);
            context.checks.push(`${context.packageJson.main} could be downloaded`);
        } catch (e) {
            common.debug(e);
            if (!context.ioPackageJson.common.nogit) {
                context.errors.push(
                    `[E124] Main file not found under URL: ${context.githubUrl}/${context.packageJson.main}.`,
                );
            } else if (!context.packageJson.main.startsWith('build/')) {
                context.warnings.push(
                    `[W138] Main file not found under URL: ${context.githubUrl}/${context.packageJson.main} and not located at build/ directory too.`,
                );
            }
        }
    }

    // single free
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
// [138] Main file not found under URL: ${context.githubUrl}/${context.packageJson.main} and not located at build/ directory too.
// [139] Please evaluate whether adapter can be modified to support compact mode.
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
// [187] "common.materialize" replaced by property "common.adminUI.config" at io-package.json. Please remove.
// [188] "common.materializeTab" replaced by property "common.adminUI.tab" at io-package.json. Please remove.
// [189] common.dependencies "admin" dependency should always allow future versions (>=x.x.x) - recommended: {"admin": ">=${recommendedAdminVersion}".
// [190] admin dependency missing. admin ${requiredAdminVersion} is required as minimum, ${recommendedAdminVersion} is recommended. Please add to dependencies at io-package.json.
// [191] admin dependency (${adminDependency['admin']}) at io-package.json is not required. Feel free to remove.
// [192] extension adapters must list web adapter as dependency in io-package.json
// [193] Encrypted native "${encrypted}" not listed at "protectedNative" in io-package.json
// [194] Protected native "${protected}" not listed at "encryptedNative" in io-package.json
// [195] Protected or encrypted element "${protected}" not listed as "native" in io-package.json
// [196] "common.supportCustoms" requires "common.adminUI.custom" to be defined
// [197] External icon ${context.ioPackageJson.common.extIcon} cannot be parsed
// [198] "common.encryptedNative" must be an array at io-package.json
// [199] "common.protectedNative" must be an array at io-package.json
// [200] Empty dependency objects found in "common.dependencies" at io-package.json. Please remove empty objects.
// [201] Empty dependency objects found in "common.globalDependencies" at io-package.json. Please remove empty objects.
// [202] Consider adding 'vis-2' to "common.restartAdapters" as 'vis' is already listed in io-package.json
// [203] Encryption of array elements "${key}" is not yet available

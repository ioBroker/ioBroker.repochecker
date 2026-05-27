'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   i18n translation files
    Numbering   :   5600 - 5699

*/

const JSON5 = require('json5');

const common = require('./common.js');

// Directories to always exclude when scanning for i18n content
const I18N_EXCLUDED_DIRS = new Set(['node_modules', '.git', '.vscode', '.dev-server']);

// Translatable attributes in jsonConfig to scan for proper i18n usage.
// Add new attribute names here to extend the list of attributes checked.
const TRANSLATABLE_ATTRS = [
    'label',
    'textAlive',
    'textNotAlive',
    'tooltip',
    'help',
    'placeholder',
    'validatorErrorText',
];
const MAX_W5612_WARNINGS = 10;

/**
 * Escape a string for use as a literal in a regular expression.
 *
 * @param {string} str - The string to escape.
 * @returns {string} - The escaped string safe for use in a RegExp constructor.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Discover all i18n directory paths from the repository file list.
 * Recognises both long format ({lang}/translations.json) and short format ({lang}.json).
 *
 * @param {string[]} filesList - list of file paths (each with a leading slash)
 * @returns {string[]} - unique i18n directory paths (with leading slash), e.g. ['/admin/i18n']
 */
function discoverI18nDirs(filesList) {
    const i18nDirs = new Set();

    for (const filePath of filesList) {
        // Skip files inside excluded directories
        const parts = filePath.split('/').filter(p => p !== '');
        if (parts.some(p => I18N_EXCLUDED_DIRS.has(p))) {
            continue;
        }

        // Long format: .../i18n/{lang}/translations.json
        const longMatch = filePath.match(/^(.*\/i18n)\/([^/]+)\/translations\.json$/);
        if (longMatch) {
            i18nDirs.add(longMatch[1]);
            continue;
        }

        // Short format: .../i18n/{lang}.json
        const shortMatch = filePath.match(/^(.*\/i18n)\/([^/]+)\.json$/);
        if (shortMatch) {
            i18nDirs.add(shortMatch[1]);
        }
    }

    return [...i18nDirs];
}

/**
 * Return the list of i18n-related file paths that need to be loaded.
 * Called before the main file-loading phase to ensure all i18n files are available.
 *
 * @param {string[]} filesList - List of all repository file paths (each with a leading slash).
 * @returns {string[]} - i18n file paths to include in the readFiles list.
 */
function getI18nFilesToRead(filesList) {
    const filesToRead = [];

    for (const filePath of filesList) {
        // Skip files inside excluded directories
        const parts = filePath.split('/').filter(p => p !== '');
        if (parts.some(p => I18N_EXCLUDED_DIRS.has(p))) {
            continue;
        }

        // Long format: .../i18n/{lang}/translations.json
        if (/\/i18n\/[^/]+\/translations\.json$/.test(filePath)) {
            filesToRead.push(filePath);
        } else if (/\/i18n\/[^/]+\.json$/.test(filePath)) {
            // Short format: .../i18n/{lang}.json
            filesToRead.push(filePath);
        }
    }

    return filesToRead;
}

/**
 * Determine which language files exist in an i18n directory and in which format.
 *
 * @param {string} i18nDir - Directory path like '/admin/i18n'.
 * @param {string[]} filesList - List of all repository file paths.
 * @returns {{ longFormat: Set<string>, shortFormat: Set<string> }} - Sets of language codes per format.
 */
function getI18nFormats(i18nDir, filesList) {
    const longFormat = new Set();
    const shortFormat = new Set();
    const escaped = escapeRegex(i18nDir);

    for (const filePath of filesList) {
        const longMatch = filePath.match(new RegExp(`^${escaped}/([^/]+)/translations\\.json$`));
        if (longMatch) {
            longFormat.add(longMatch[1]);
            continue;
        }
        const shortMatch = filePath.match(new RegExp(`^${escaped}/([^/]+)\\.json$`));
        if (shortMatch) {
            shortFormat.add(shortMatch[1]);
        }
    }

    return { longFormat, shortFormat };
}

/**
 * Load and parse translation objects for all available languages in an i18n directory.
 *
 * @param {string} i18nDir - The i18n directory path, e.g. '/admin/i18n'.
 * @param {Set<string>} longFormat  - languages present in long format
 * @param {Set<string>} shortFormat - languages present in short format
 * @param {object} context - The repochecker context object.
 * @returns {Map<string, object>} - lang → parsed translations object
 */
function loadTranslations(i18nDir, longFormat, shortFormat, context) {
    const translations = new Map();

    // Long format: {lang}/translations.json
    for (const lang of longFormat) {
        const key = `${i18nDir}/${lang}/translations.json`;
        if (context[key]) {
            try {
                translations.set(lang, JSON.parse(context[key]));
            } catch {
                // Parse errors are reported elsewhere (E5009)
            }
        }
    }

    // Short format: {lang}.json  – only when not already loaded via long format
    for (const lang of shortFormat) {
        if (!translations.has(lang)) {
            const key = `${i18nDir}/${lang}.json`;
            if (context[key]) {
                try {
                    translations.set(lang, JSON.parse(context[key]));
                } catch {
                    // Parse errors are reported elsewhere (E5009)
                }
            }
        }
    }

    return translations;
}

/**
 * Check a single i18n directory for format consistency, language completeness,
 * and translation key consistency.
 *
 * @param {object} context - The repochecker context object.
 * @param {string} i18nDir - Absolute path like '/admin/i18n'.
 */
function checkI18nDirectory(context, i18nDir) {
    const displayDir = i18nDir.replace(/^\//, '');
    const { allowedLanguages, requiredLanguages } = context.cfg;
    const { longFormat, shortFormat } = getI18nFormats(i18nDir, context.filesList);

    // E5600: Both formats coexist for the same language in the same directory
    const bothFormats = [...longFormat].filter(lang => shortFormat.has(lang));
    if (bothFormats.length > 0) {
        context.errors.push(
            `[E5600] i18n directory "${displayDir}" contains both long format ({lang}/translations.json) and short format ({lang}.json) for language(s): ${bothFormats.join(', ')}. Please use only one format.`,
        );
    }

    // S5601: Long format in use → suggest migration to short format
    if (longFormat.size > 0) {
        context.warnings.push(
            `[S5601] i18n directory "${displayDir}" uses long format ({lang}/translations.json). Consider migrating to short format ({lang}.json) using "npm run translate convert".`,
        );
    }

    // All detected languages (union of both formats)
    const allDetected = new Set([...longFormat, ...shortFormat]);

    // E5602: Required language missing → error
    for (const lang of requiredLanguages) {
        if (!allDetected.has(lang)) {
            context.errors.push(`[E5602] i18n directory "${displayDir}" is missing required language "${lang}".`);
        }
    }

    // W5603: Non-required allowed language missing → warning
    for (const lang of allowedLanguages) {
        if (!requiredLanguages.includes(lang) && !allDetected.has(lang)) {
            context.warnings.push(`[W5603] i18n directory "${displayDir}" is missing language "${lang}".`);
        }
    }

    // Load translations for key-consistency checks
    const translations = loadTranslations(i18nDir, longFormat, shortFormat, context);
    const enTranslations = translations.get('en');

    if (!enTranslations) {
        common.debug(`No English translations available for "${displayDir}", skipping key-consistency checks.`);
        return;
    }

    const enKeys = new Set(Object.keys(enTranslations));

    for (const [lang, langTranslations] of translations) {
        if (lang === 'en') {
            continue;
        }

        const langKeys = new Set(Object.keys(langTranslations));

        // W5604: Keys in English not present in other language (missing translations)
        const missingInLang = [...enKeys].filter(k => !langKeys.has(k));
        if (missingInLang.length > 0) {
            context.warnings.push(
                `[W5604] i18n "${displayDir}" language "${lang}" is missing ${missingInLang.length} key(s) present in English: ${missingInLang.slice(0, 5).join(', ')}${missingInLang.length > 5 ? ', ...' : ''}`,
            );
        }

        // W5605: Keys in other language not present in English (outdated translations)
        const outdated = [...langKeys].filter(k => !enKeys.has(k));
        if (outdated.length > 0) {
            context.warnings.push(
                `[W5605] i18n "${displayDir}" language "${lang}" has ${outdated.length} outdated key(s) not present in English: ${outdated.slice(0, 5).join(', ')}${outdated.length > 5 ? ', ...' : ''}`,
            );
        }

        // W5606: Too many identical translations (>5 non-trivial identical strings)
        const identical = [...enKeys].filter(
            k =>
                langKeys.has(k) &&
                typeof enTranslations[k] === 'string' &&
                typeof langTranslations[k] === 'string' &&
                enTranslations[k].length > 1 &&
                enTranslations[k] === langTranslations[k],
        );
        if (identical.length > [...enKeys].length * 0.75) {
            context.warnings.push(
                `[W5606] i18n "${displayDir}" language "${lang}" has ${identical.length} translation(s) identical to English (i.e. ${identical[0]}). This may indicate untranslated content.`,
            );
        }
    }
}

/**
 * Recursively collect translatable attribute values from a jsonConfig node.
 *
 * @param {any} node - jsonConfig node to scan
 * @param {string} currentPath - path in the jsonConfig for error reporting
 * @returns {Array<{attr: string, value: any, path: string, noTranslation: boolean}>} - Collected attribute entries.
 */
function collectTranslatableValues(node, currentPath) {
    if (!node || typeof node !== 'object') {
        return [];
    }

    const results = [];

    if (Array.isArray(node)) {
        node.forEach((item, i) => {
            results.push(...collectTranslatableValues(item, `${currentPath}[${i}]`));
        });
        return results;
    }

    // If this node has noTranslation set, its string values should not be checked
    const noTranslation = node.noTranslation === true;

    for (const [key, value] of Object.entries(node)) {
        if (TRANSLATABLE_ATTRS.includes(key) && value !== undefined && value !== null) {
            results.push({ attr: key, value, path: currentPath, noTranslation });
        }

        // Recurse into child objects and arrays
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            results.push(...collectTranslatableValues(value, `${currentPath}/${key}`));
        } else if (Array.isArray(value)) {
            value.forEach((item, i) => {
                if (typeof item === 'object' && item !== null) {
                    results.push(...collectTranslatableValues(item, `${currentPath}/${key}[${i}]`));
                }
            });
        }
    }

    return results;
}

/**
 * Determine the i18n directory associated with a jsonConfig file.
 * The default is the same directory as the jsonConfig file + '/i18n'.
 * If the jsonConfig has an `i18n` string attribute, that path is used instead
 * (interpreted as relative to the repository root).
 *
 * @param {string} configFile - file path like '/admin/jsonConfig.json'
 * @param {object} jsonConfig  - parsed jsonConfig object
 * @returns {string} - resolved i18n directory path like '/admin/i18n'
 */
function getI18nDirForJsonConfig(context, configFile, jsonConfig) {
    const configDir = configFile.replace(/\/[^/]+$/, '') || ''; // e.g. '/admin', or '' for root-level files
    if (typeof jsonConfig.i18n === 'string' && jsonConfig.i18n.trim() !== '') {
        const customPath = jsonConfig.i18n.trim();
        if (!customPath.endsWith('/i18n')){
            context.errors.push(
                `[E5618] "Custom path specified at i18n attribute (${customPath}) must end with '/i18n'`,
            );
        }
        // Interpret as absolute path from repo root (with leading slash) or relative to admin
        return customPath.startsWith('/') ? customPath : `/admin/${customPath}`;
    }

    // Default: directory of the jsonConfig file + '/i18n'
    return `${configDir}/i18n`;
}

/**
 * Check translatable attributes in a jsonConfig for proper i18n handling.
 *
 * @param {object} context - The repochecker context object.
 * @param {string} configFile - file path like '/admin/jsonConfig.json'
 * @param {object} jsonConfig - parsed jsonConfig object
 * @param {string} i18nDir    - associated i18n directory path like '/admin/i18n'
 */
function checkJsonConfigTranslations(context, configFile, jsonConfig, i18nDir, w5612State) {
    const displayConfig = configFile.replace(/^\//, '');
    const { allowedLanguages, requiredLanguages } = context.cfg;
    const i18nMode = jsonConfig.i18n;

    // Load English translations for string-key checking
    let enTranslations = null;
    const enLongKey = `${i18nDir}/en/translations.json`;
    const enShortKey = `${i18nDir}/en.json`;
    if (context[enLongKey]) {
        try {
            enTranslations = JSON.parse(context[enLongKey]);
        } catch {
            /* parse errors are reported elsewhere */
        }
    } else if (context[enShortKey]) {
        try {
            enTranslations = JSON.parse(context[enShortKey]);
        } catch {
            /* parse errors are reported elsewhere */
        }
    }

    // Determine whether any i18n files exist at the expected directory
    const escaped = escapeRegex(i18nDir);
    const i18nDirExists = context.filesList.some(f => new RegExp(`^${escaped}/`).test(f));

    // W5615: i18n enabled but the i18n directory is absent
    if (i18nMode === true || typeof i18nMode === 'string') {
        if (!i18nDirExists) {
            context.warnings.push(
                `[W5615] "${displayConfig}" has i18n enabled but no i18n directory found at "${i18nDir.replace(/^\//, '')}". Please create translation files.`,
            );
        }
    }

    // W5614: i18n=false but an i18n directory exists (will not be used)
    if (i18nMode === false) {
        if (i18nDirExists) {
            context.warnings.push(
                `[W5614] "${displayConfig}" has i18n=false but an i18n directory exists at "${i18nDir.replace(/^\//, '')}". This i18n directory will not be used by this jsonConfig.`,
            );
        }
    }

    // Scan for translatable attributes only when i18n is explicitly configured
    // (skip when i18n is not set to avoid flooding adapters that use words.js or other mechanisms)
    if (i18nMode === undefined || i18nMode === null) {
        return;
    }

    const translatables = collectTranslatableValues(jsonConfig, displayConfig);

    for (const { attr, value, path, noTranslation } of translatables) {
        // Skip attributes where the component declares noTranslation: true
        if (noTranslation) {
            continue;
        }

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Value is an inline i18n object (e.g. { en: "Name", de: "Name" })
            if (i18nMode === true || typeof i18nMode === 'string') {
                // When i18n files are used, translatable attributes should be string keys
                // context.warnings.push(
                //     `[W5616] "${path}" attribute "${attr}" defines inline i18n object while i18n is enabled. Consider using a translation key string instead.`,
                // );
            } else {
                // i18n=false: check that required languages are present in the object
                for (const lang of requiredLanguages) {
                    if (!Object.prototype.hasOwnProperty.call(value, lang)) {
                        context.errors.push(
                            `[E5610] "${path}" attribute "${attr}" is missing required language "${lang}" in i18n object.`,
                        );
                    }
                }
                for (const lang of allowedLanguages) {
                    if (!requiredLanguages.includes(lang) && !Object.prototype.hasOwnProperty.call(value, lang)) {
                        context.warnings.push(
                            `[W5611] "${path}" attribute "${attr}" is missing language "${lang}" in i18n object.`,
                        );
                    }
                }
            }
        } else if (typeof value === 'string') {
            if (i18nMode === false) {
                // When i18n=false, translatable attributes should be inline objects
                context.warnings.push(
                    `[W5617] "${path}" attribute "${attr}" uses a plain string while jsonConfig has i18n=false. Consider using an inline i18n object instead.`,
                );
            } else if (enTranslations !== null) {
                // i18n enabled: check that the string is a valid key in the English translations
                if (!Object.prototype.hasOwnProperty.call(enTranslations, value)) {
                    if (value.match(/[a-zA-Z]/) && value.length >= 3) {
                        // do not force translations of labels containing no characters
                        if (w5612State.count < MAX_W5612_WARNINGS) {
                            context.warnings.push(
                                `[W5612] "${path}" attribute "${attr}" uses key "${value}" which is not found in the English translation file at "${i18nDir.replace(/^\//, '')}/en".`,
                            );
                            w5612State.count++;
                        } else if (!w5612State.limitWarningAdded) {
                            context.warnings.push(
                                `[W5612] Maximum number of W5612 warnings (${MAX_W5612_WARNINGS}) has been reached. Additional W5612 warnings exist.`,
                            );
                            w5612State.limitWarningAdded = true;
                        }
                    }
                }
            }
        }
    }
}

/**
 * Main entry point: check all i18n directories found in the repository and
 * validate jsonConfig files for correct i18n attribute usage.
 *
 * @param {object} context - The repochecker context object.
 */
function checkAllI18n(context) {
    //console.log('\n[5600 - 5699] checkAllI18n');

    // 1. Check every discovered i18n directory
    const i18nDirs = discoverI18nDirs(context.filesList);
    common.debug(`Discovered ${i18nDirs.length} i18n director(ies): ${i18nDirs.join(', ')}`);

    for (const i18nDir of i18nDirs) {
        checkI18nDirectory(context, i18nDir);
    }

    // 2. Check jsonConfig files for correct i18n attribute usage and translatable attribute consistency
    const jsonConfigFiles = ['/admin/jsonConfig.json', '/admin/jsonConfig.json5'];
    // Limit W5612 globally across all jsonConfig files processed in one run.
    const w5612State = { count: 0, limitWarningAdded: false };

    for (const configFile of jsonConfigFiles) {
        if (!context[configFile]) {
            continue;
        }

        let jsonConfig;
        try {
            jsonConfig = configFile.endsWith('.json5')
                ? JSON5.parse(context[configFile])
                : JSON.parse(context[configFile]);
        } catch {
            // Parse errors are reported elsewhere (E5007)
            continue;
        }

        const i18nDir = getI18nDirForJsonConfig(context, configFile, jsonConfig);
        checkJsonConfigTranslations(context, configFile, jsonConfig, i18nDir, w5612State);
    }
}

exports.checkAllI18n = checkAllI18n;
exports.getI18nFilesToRead = getI18nFilesToRead;

// List of error and warning codes used by this module
// ----------------------------------------------------

// [E5600] i18n directory contains both long and short format for the same language
// [S5601] Suggest migrating from long format to short format using npm run translate convert
// [E5602] i18n directory is missing a required language
// [W5603] i18n directory is missing a non-required language
// [W5604] English translation key not present in another language (missing translation)
// [W5605] Translation key in non-English file not present in English (outdated translation)
// [W5606] More than 5 translations are identical between English and another language
// [E5610] jsonConfig translatable attribute i18n object missing a required language
// [W5611] jsonConfig translatable attribute i18n object missing a non-required language
// [W5612] jsonConfig translatable attribute string key not found in English translation file
// [W5614] jsonConfig has i18n=false but an i18n directory exists (will not be used)
// [W5615] jsonConfig has i18n enabled but the expected i18n directory does not exist
// [W5616] jsonConfig has i18n enabled but a translatable attribute uses an inline i18n object
// [W5617] jsonConfig has i18n=false but a translatable attribute uses a plain string
// [E5618] "Custom path specified at i18n attribute (${customPath}) must end with '/i18n'

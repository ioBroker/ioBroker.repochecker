'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   .gitignore, .npmignore
    Numbering   :   9000 - 9998

    NOTE: requires filesList to be loaded
*/

/*
    TODO:
    - something is wrong with undefined 'check' variable
    - conversion of github to regex is wrong with multiple stars
*/

// const common = require('./common.js');
const minimatch = require('minimatch');

// Source directories whose i18n subdirectories are excluded from npm packaging checks,
// since their contents are typically compiled/moved to build/ or admin/ during the build process.
const SRC_DIRS_TO_IGNORE = ['src', 'src-admin', 'admin-src'];

/**
 * Returns a deduplicated list of i18n directory paths found in the given file list.
 * Example: '/admin/i18n/en/translations.json' → '/admin/i18n'
 * Directories under src, src-admin or admin-src are excluded as those are build sources
 * and are not packaged directly.
 *
 * @param {string[]} filesList  list of file paths from the repository (each with a leading slash)
 * @returns {string[]} array of unique i18n directory paths with leading slash
 */
function findI18nDirs(filesList) {
    const i18nDirs = new Set();
    for (const file of filesList) {
        const match = file.match(/^(\/(?:[^/]+\/)*i18n)(?:\/|$)/);
        if (match) {
            const i18nDir = match[1]; // e.g. '/admin/i18n'
            // Skip i18n dirs that reside directly inside a source directory
            const topLevel = i18nDir.replace(/^\//, '').split('/')[0];
            if (!SRC_DIRS_TO_IGNORE.includes(topLevel)) {
                i18nDirs.add(i18nDir);
            }
        }
    }
    return [...i18nDirs];
}

/**
 * Returns true if the given entry string contains glob wildcard characters.
 *
 * @param {string} entry  a package.json "files" entry
 * @returns {boolean} true if the entry contains glob wildcard characters
 */
function isGlobPattern(entry) {
    return /[*?{]/.test(entry);
}

/**
 * Checks whether the given i18n directory is covered by any entry in the package.json "files" array.
 * Handles both plain path entries and glob patterns (using minimatch).
 *
 * @param {string} i18nDir  e.g. '/admin/i18n'
 * @param {string[]} filesEntries  entries from package.json "files"
 * @param {string[]} [allFiles]  full list of repository file paths (each with a leading slash); required for glob matching
 * @returns {boolean} true if the i18n directory is included
 */
function isI18nDirIncludedInFiles(i18nDir, filesEntries, allFiles) {
    const i18nPath = i18nDir.replace(/^\//, ''); // e.g. 'admin/i18n'
    // Collect all repo files that live inside this i18n directory (strip leading slash)
    const i18nFiles = (allFiles || [])
        .filter(f => {
            const rel = f.replace(/^\//, '');
            return rel === i18nPath || rel.startsWith(`${i18nPath}/`);
        })
        .map(f => f.replace(/^\//, ''));

    return filesEntries.some(entry => {
        const normalized = entry.replace(/^\.\//, '').replace(/\/+$/, '');

        if (isGlobPattern(entry)) {
            // Use minimatch to test whether any file inside the i18n directory matches the glob
            return i18nFiles.some(file => minimatch(file, entry, { dot: true }));
        }

        // Plain path: covered if entry is exactly the i18n dir, a parent dir, or '.' (root)
        return normalized === '.' || normalized === i18nPath || i18nPath.startsWith(`${normalized}/`);
    });
}

/**
 * Checks whether the given i18n directory is excluded by any rule in the .npmignore rule list.
 *
 * @param {string} i18nDir  e.g. '/admin/i18n'
 * @param {Array<string|RegExp>} rules  parsed .npmignore rules
 * @returns {boolean} true if the i18n directory is excluded
 */
function isI18nDirExcluded(i18nDir, rules) {
    const i18nPath = i18nDir.replace(/^\//, ''); // e.g. 'admin/i18n'
    return rules.some(rule => {
        if (typeof rule === 'string') {
            const normalized = rule.replace(/^\//, '').replace(/\/+$/, '');
            return normalized === i18nPath;
        }
        return rule.test(i18nPath) || rule.test(`${i18nPath}/`);
    });
}

// 900 - ???
async function checkGitIgnore(context) {
    console.log('\n[E9000 - E9499] checkGitIgnore');
    const checkFiles = ['.idea', 'tmp', 'node_modules'];

    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/.gitignore

    if (!context.filesList) {
        throw 'FATAL:context.fileslist is undefined';
    }

    if (!context.filesList.includes('/.gitignore')) {
        context.errors.push(`[E9001] .gitignore not found`);
    } else {
        const rules = (context['/.gitignore'] || '')
            .split('\n')
            .map(line => line.trim().replace('\r', ''))
            .filter(line => line);
        let tooComplexToCheck = false;
        rules.forEach((name, i) => {
            if (name.includes('*')) {
                try {
                    rules[i] = new RegExp(
                        name.replace('.', '\\.').replace('/', '\\/').replace('**', '.*').replace('*', '[^\\/]*'),
                    );
                } catch {
                    tooComplexToCheck = true;
                }
            }
        });

        /* TODO: something is wrong with undefined 'check' variable
        if (!rules.includes('node_modules') && !rules.includes('/node_modules') && !rules.includes('/node_modules/*') && !rules.includes('node_modules/*')) {
            !check && context.errors.push(`[E9002] node_modules not found in .npmignore`);
        }
        if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
            !check && context.errors.push(`[E9003] iob_npm.done not found in .gitignore`);
        }
        */

        if (!tooComplexToCheck) {
            checkFiles.forEach(file => {
                if (context.filesList.includes(`/${file}`)) {
                    // maybe it is with regex
                    const check = rules.some(rule => {
                        if (typeof rule === 'string') {
                            return rule === file || rule === file.replace(/\/$/, '');
                        }
                        return rule.test(file);
                    });

                    !check &&
                        context.errors.push(`[E9004] file ${file} found in repository, but not found in .gitignore`);
                }
            });
        }

        // Check for .commitinfo file presence
        if (context.filesList.includes('/.commitinfo')) {
            context.errors.push('[E9005] .commitinfo file found in repository, please remove it');
        }

        // Check if .commitinfo is excluded by .gitignore (independent of file presence)
        if (!tooComplexToCheck) {
            const isIgnored = rules.some(rule => {
                if (typeof rule === 'string') {
                    return rule === '.commitinfo' || rule === '/.commitinfo';
                }
                return rule.test('.commitinfo');
            });

            if (!isIgnored) {
                // convert to warning mid of 2026
                context.warnings.push(
                    '[S9006] .commitinfo file should be excluded by .gitignore, please add a line with text ".commitinfo" to .gitignore',
                );
            }
        }
    }

    return context;
}

// 950 - 989
async function checkNpmIgnore(context) {
    console.log('\n[E9500 - E9998] checkNpmIgnore');
    const checkFiles = [
        'node_modules/',
        'test/',
        'src/',
        'appveyor.yml',
        '.travis.yml',
        'tsconfig.json',
        'tsconfig.build.json',
        // 'iob_npm.done',
        // '.git/',
        // '.github/',
        // '.idea/',
        // '.gitignore',
        // '.npmignore',
        // '.travis.yml',
        // '.babelrc',
        // '.editorconfig',
        // '.eslintignore',
        // '.eslintrc.js',
        // '.fimbullinter.yaml',
        // '.lgtm.yml',
        // '.prettierignore',
        // '.prettierignore',
        // '.prettierrc.js',
        // '.vscode/',
    ];

    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/.npmignore
    if (context.packageJson.files && context.packageJson.files.length) {
        if (context.filesList.includes('/.npmignore')) {
            context.warnings.push(
                `[W9501] .npmignore found but "files" is used at package.json. Please remove .npmignore.`,
            );
        } else {
            context.checks.push('package.json "files" already used.');
        }

        // Check that i18n directories present in the repo are covered by the "files" entries
        const i18nDirs = findI18nDirs(context.filesList);
        for (const i18nDir of i18nDirs) {
            if (!isI18nDirIncludedInFiles(i18nDir, context.packageJson.files, context.filesList)) {
                context.errors.push(
                    `[E9507] i18n directory "${i18nDir.replace(/^\//, '')}" found in repository but is not included in package.json "files". Translations will be missing from the npm package.`,
                );
            }
        }

        return context;
    }

    // package.json files section is NOT used
    if (!context.filesList.includes('/.npmignore')) {
        context.errors.push(
            `[E9502] neither files section at package.json nor file .npmignore found. npm package will contain unwanted files.`,
        );
    } else {
        context.warnings.push(`[W9503] .npmignore found - consider using package.json object "files" instead.`);

        const rules = (context['/.npmignore'] || '')
            .split('\n')
            .map(line => line.trim().replace('\r', ''))
            .filter(line => line);
        let tooComplexToCheck = false;
        rules.forEach((name, i) => {
            if (name.includes('*')) {
                try {
                    rules[i] = new RegExp(
                        name.replace('.', '\\.').replace('/', '\\/').replace('**', '.*').replace('*', '[^\\/]*'),
                    );
                } catch {
                    tooComplexToCheck = true;
                }
            }
            if (name.startsWith('!')) {
                tooComplexToCheck = true;
            }
        });

        // There's no need to put node_modules in `.npmignore`. npm will never publish node_modules in the package, except if one of the modules is explicitly mentioned in bundledDependencies.
        /*if (!rules.includes('node_modules') && !rules.includes('/node_modules') && !rules.includes('/node_modules/*') && !rules.includes('node_modules/*')) {
            !check && context.errors.push(`[E9504] node_modules not found in `.npmignore``);
        }*/
        if (!tooComplexToCheck) {
            // if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
            //     /*!check &&*/ context.errors.push(`[E9505] iob_npm.done not found in .npmignore`);
            // }

            checkFiles.forEach(file => {
                if (context.filesList.includes(`/${file}`)) {
                    // maybe it is with regex
                    const check = rules.some(rule => {
                        if (typeof rule === 'string') {
                            return rule === file || rule === file.replace(/\/$/, '');
                        }
                        return rule.test(file);
                    });

                    !check &&
                        context.errors.push(`[E9010] file ${file} found in repository, but not found in .npmignore`);
                }
            });

            // Check that i18n directories are not excluded by .npmignore
            const i18nDirs = findI18nDirs(context.filesList);
            for (const i18nDir of i18nDirs) {
                if (isI18nDirExcluded(i18nDir, rules)) {
                    context.errors.push(
                        `[E9506] i18n directory "${i18nDir.replace(/^\//, '')}" is excluded by .npmignore. Translations will be missing from the npm package.`,
                    );
                }
            }
        }
    }
    return context;
}

exports.checkGitIgnore = checkGitIgnore;
exports.checkNpmIgnore = checkNpmIgnore;

// List of error and warnings used at this module
// ----------------------------------------------

// [9001] .gitignore not found
// [9002] node_modules not found in .npmignore
// [9003] iob_npm.done not found in .gitignore
// [9004] file ${file} found in repository, but not found in .gitignore
// [9005] .commitinfo file found in repository, please remove it
// [9006] .commitinfo file should be excluded by .gitignore, consider adding it to .gitignore

// [9010] file ${file} found in repository, but not found in .npmignore.

// [9501] .npmignore found but "files" is used at package.json. Please remove .npmignore.
// [9502] .npmignore not found
// [9503] .npmignore found - consider using package.json object "files" instead.
// [9504] node_modules not found in `.npmignore`
// [9505] iob_npm.done not found in .npmignore` ### removed ###
// [9506] i18n directory excluded by .npmignore
// [9507] i18n directory not included in package.json "files"

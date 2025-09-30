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

function paddingNum(num) {
    if (num >= 10) {
        return num;
    }
    return `0${num}`;
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

        // Check if i18n directories exist and are included in files section
        const i18nDirs = context.filesList.filter(file => file.match(/^\/admin\/i18n\//));
        if (i18nDirs.length > 0) {
            // Check if any i18n pattern is included in files
            const hasI18nIncluded = context.packageJson.files.some(pattern => {
                // Check for various patterns that would include admin/i18n
                return (
                    pattern === 'admin/i18n' ||
                    pattern === 'admin/i18n/' ||
                    pattern === 'admin/i18n/**' ||
                    pattern === 'admin/' ||
                    pattern === 'admin/**' ||
                    pattern === 'admin' ||
                    pattern.startsWith('admin/i18n')
                );
            });

            if (!hasI18nIncluded) {
                context.errors.push(
                    `[E9506] i18n directory found but not included in package.json "files" section. Please add "admin/i18n/" to the files array.`,
                );
            } else {
                context.checks.push('i18n directory is included in package.json "files" section.');
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

            checkFiles.forEach((file, i) => {
                if (context.filesList.includes(`/${file}`)) {
                    // maybe it is with regex
                    const check = rules.some(rule => {
                        if (typeof rule === 'string') {
                            return rule === file || rule === file.replace(/\/$/, '');
                        }
                        return rule.test(file);
                    });

                    !check &&
                        context.errors.push(
                            `[E9${paddingNum(i + 61)}] file ${file} found in repository, but not found in .npmignore`,
                        );
                }
            });

            // Check if i18n directories exist and are not excluded by .npmignore
            const i18nDirs = context.filesList.filter(file => file.match(/^\/admin\/i18n\//));
            if (i18nDirs.length > 0) {
                // Check if admin/i18n is excluded by any rule
                const isI18nExcluded = rules.some(rule => {
                    if (typeof rule === 'string') {
                        // Check for patterns that would exclude admin/i18n
                        return (
                            rule === 'admin/i18n' ||
                            rule === 'admin/i18n/' ||
                            rule === '/admin/i18n' ||
                            rule === '/admin/i18n/' ||
                            rule === 'admin' ||
                            rule === '/admin' ||
                            rule === 'admin/' ||
                            rule === '/admin/'
                        );
                    }
                    // Check if regex would match admin/i18n
                    return rule.test('admin/i18n/') || rule.test('admin/i18n/en/translations.json');
                });

                if (isI18nExcluded) {
                    context.errors.push(
                        `[E9507] i18n directory found but excluded by .npmignore. Please remove patterns that exclude admin/i18n from .npmignore.`,
                    );
                } else {
                    context.checks.push('i18n directory is not excluded by .npmignore.');
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

// [9501] .npmignore found but "files" is used at package.json. Please remove .npmignore.
// [9502] .npmignore not found
// [9503] .npmignore found - consider using package.json object "files" instead.
// [9504] node_modules not found in `.npmignore`
// [9505] iob_npm.done not found in .npmignore` ### removed ###
// [9506] i18n directory found but not included in package.json "files" section. Please add "admin/i18n/" to the files array.
// [9507] i18n directory found but excluded by .npmignore. Please remove patterns that exclude admin/i18n from .npmignore.

// [W9006] .commitinfo file should be excluded by .gitignore, consider adding it to .gitignore

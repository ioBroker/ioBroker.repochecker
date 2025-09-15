'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   .gitignore, .npmignore
    Numbering   :   900 - 998

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
    console.log('\n[E900 - E950] checkGitIgnore');
    const checkFiles = ['.idea', 'tmp', 'node_modules'];

    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/.gitignore

    if (!context.filesList) {
        throw 'FATAL:context.fileslist is undefined';
    }

    if (!context.filesList.includes('/.gitignore')) {
        context.errors.push(`[E901] .gitignore not found`);
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
            !check && context.errors.push(`[E902] node_modules not found in .npmignore`);
        }
        if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
            !check && context.errors.push(`[E903] iob_npm.done not found in .gitignore`);
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
                        context.errors.push(`[E904] file ${file} found in repository, but not found in .gitignore`);
                }
            });
        }

        // Check for .commitinfo file presence
        if (context.filesList.includes('/.commitinfo')) {
            context.errors.push('[E905] .commitinfo file found in repository, please remove it');
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
                    '[S906] .commitinfo file should be excluded by .gitignore. Please a6dd a line ".commitinfo" to file ".gitignore"',
                );
            }
        }
    }

    return context;
}

// 950 - 989
async function checkNpmIgnore(context) {
    console.log('\n[E950 - E989] checkNpmIgnore');
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
                `[W951] .npmignore found but "files" is used at package.json. Please remove .npmignore.`,
            );
        } else {
            context.checks.push('package.json "files" already used.');
        }
        return context;
    }

    // package.json files section is NOT used
    if (!context.filesList.includes('/.npmignore')) {
        context.errors.push(
            `[E952] neither files section at package.json nor file .npmignore found. npm package will contain unwanted files.`,
        );
    } else {
        context.warnings.push(`[W953] .npmignore found - consider using package.json object "files" instead.`);

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
            !check && context.errors.push(`[E954] node_modules not found in `.npmignore``);
        }*/
        if (!tooComplexToCheck) {
            // if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
            //     /*!check &&*/ context.errors.push(`[E955] iob_npm.done not found in .npmignore`);
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
        }
    }
    return context;
}

exports.checkGitIgnore = checkGitIgnore;
exports.checkNpmIgnore = checkNpmIgnore;

// List of error and warnings used at this module
// ----------------------------------------------

// [901] .gitignore not found
// [902] node_modules not found in .npmignore
// [903] iob_npm.done not found in .gitignore
// [904] file ${file} found in repository, but not found in .gitignore
// [905] .commitinfo file found in repository, please remove it

// [951] .npmignore found but "files" is used at package.json. Please remove .npmignore.
// [952] .npmignore not found
// [953] .npmignore found - consider using package.json object "files" instead.
// [954] node_modules not found in `.npmignore`
// [955] iob_npm.done not found in .npmignore` ### removed ###

// [W906] .commitinfo file should be excluded by .gitignore, consider adding it to .gitignore

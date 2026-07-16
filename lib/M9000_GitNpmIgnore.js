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
const { minimatch } = require('minimatch');

// Source directories (or directory paths) whose i18n subdirectories are excluded from npm packaging
// checks, since their contents are typically compiled/moved to build/ or admin/ during the build
// process. Entries may be top-level directory names (e.g. 'src') or multi-level paths (e.g.
// 'admin/src'). An i18n directory is ignored when its parent path equals one of these entries or
// starts with one of these entries followed by '/'.
const SRC_DIRS_TO_IGNORE = [
    'src',
    'src-admin',
    'src-editor',
    'src-rules',
    'src-widgets',
    'admin-src',
    'rules-src',
    'admin/src',
];

function normalizeRepoPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!normalized) {
        return '/';
    }
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function getTrackedRepositoryEntries(filesList) {
    const entries = new Map();

    for (const file of filesList) {
        const normalized = normalizeRepoPath(file);
        if (normalized === '/') {
            continue;
        }

        if (!entries.has(normalized)) {
            entries.set(normalized, { path: normalized, isDirectory: false });
        }

        const parts = normalized.replace(/^\//, '').split('/');
        for (let i = 1; i < parts.length; i++) {
            const directoryPath = `/${parts.slice(0, i).join('/')}`;
            entries.set(directoryPath, { path: directoryPath, isDirectory: true });
        }
    }

    return [...entries.values()].sort((a, b) => {
        const depthA = a.path.split('/').length;
        const depthB = b.path.split('/').length;
        if (depthA !== depthB) {
            return depthA - depthB;
        }
        if (a.isDirectory !== b.isDirectory) {
            return Number(b.isDirectory) - Number(a.isDirectory);
        }
        return a.path.localeCompare(b.path);
    });
}

function parseIgnoreRules(ignoreFile) {
    return ignoreFile
        .split('\n')
        .map(line => line.replace(/\r/g, '').trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            let pattern = line;
            let negated = false;

            if (pattern.startsWith('\\#') || pattern.startsWith('\\!')) {
                pattern = pattern.slice(1);
            } else if (pattern.startsWith('!')) {
                negated = true;
                pattern = pattern.slice(1);
            }

            const directoryOnly = pattern.endsWith('/');
            const anchored = pattern.startsWith('/');
            pattern = pattern.replace(/^\/+/, '').replace(/\/+$/, '');

            if (!pattern) {
                return null;
            }

            return {
                anchored,
                directoryOnly,
                hasSlash: pattern.includes('/'),
                negated,
                pattern,
            };
        })
        .filter(Boolean);
}

function getIgnoreCandidates(filePath, isDirectory) {
    const normalized = normalizeRepoPath(filePath);
    const path = normalized.replace(/^\//, '');
    const candidates = [{ isDirectory, path }];
    const parts = path.split('/');

    for (let i = 1; i < parts.length; i++) {
        candidates.push({ isDirectory: true, path: parts.slice(0, i).join('/') });
    }

    return candidates;
}

function matchesIgnoreRule(rule, candidate) {
    if (rule.directoryOnly && !candidate.isDirectory) {
        return false;
    }

    if (rule.anchored || rule.hasSlash) {
        return minimatch(candidate.path, rule.pattern, { dot: true });
    }

    return candidate.path.split('/').some(segment => minimatch(segment, rule.pattern, { dot: true }));
}

function isPathIgnoredByRules(filePath, isDirectory, rules) {
    const normalized = normalizeRepoPath(filePath);
    if (normalized === '/') {
        return false;
    }

    const candidates = getIgnoreCandidates(normalized, isDirectory);
    let ignored = false;

    for (const rule of rules) {
        if (candidates.some(candidate => matchesIgnoreRule(rule, candidate))) {
            ignored = !rule.negated;
        }
    }

    return ignored;
}

function findIgnoredTrackedEntries(trackedEntries, rules) {
    const ignoredEntries = [];
    const ignoredDirectories = [];

    for (const entry of trackedEntries) {
        if (ignoredDirectories.some(directory => entry.path.startsWith(`${directory}/`))) {
            continue;
        }

        if (isPathIgnoredByRules(entry.path, entry.isDirectory, rules)) {
            ignoredEntries.push(entry);
            if (entry.isDirectory) {
                ignoredDirectories.push(entry.path);
            }
        }
    }

    return ignoredEntries;
}

/**
 * Returns a deduplicated list of i18n directory paths found in the given file list.
 * Example: '/admin/i18n/en/translations.json' → '/admin/i18n'
 * Directories whose parent path matches any entry in SRC_DIRS_TO_IGNORE (exact match or prefix)
 * are excluded because their contents are build sources and are not packaged directly.
 *
 * @param {string[]} filesList  list of file paths from the repository (each with a leading slash)
 * @returns {string[]} array of unique i18n directory paths with leading slash
 */
function findI18nDirs(filesList) {
    const i18nDirs = new Set();
    for (const file of filesList) {
        const match = file.match(/^(\/(?:[^/]+\/)*i18n)(?:\/|$)/);
        if (match) {
            const i18nDir = match[1]; // e.g. '/admin/i18n' or '/src-rules/src/i18n'
            const i18nPath = i18nDir.replace(/^\//, ''); // strip leading slash
            // parentPath is everything before the final '/i18n' segment
            const parts = i18nPath.split('/');
            const parentPath = parts.slice(0, -1).join('/'); // e.g. 'admin', 'src-rules/src', ''
            // Skip i18n dirs that reside inside a known source directory (or sub-path thereof)
            const isInSrcDir = SRC_DIRS_TO_IGNORE.some(
                srcDir => parentPath === srcDir || parentPath.startsWith(`${srcDir}/`),
            );
            if (!isInSrcDir) {
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
 * Checks whether a specific file path is included by package.json "files" entries.
 * Handles both plain path entries and glob patterns (using minimatch).
 *
 * @param {string} filePath  file path without leading slash (e.g. 'CHANGELOG_OLD.md')
 * @param {string[]} filesEntries  entries from package.json "files"
 * @returns {boolean} true if the file is included
 */
function isFileIncludedInFiles(filePath, filesEntries) {
    return filesEntries.some(entry => {
        const normalized = entry.replace(/^\.?\//, '').replace(/\/+$/, '');

        if (isGlobPattern(entry)) {
            return minimatch(filePath, normalized, { dot: true });
        }

        return normalized === '.' || normalized === filePath || filePath.startsWith(`${normalized}/`);
    });
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
        const rules = parseIgnoreRules(context['/.gitignore'] || '');
        const trackedEntries = getTrackedRepositoryEntries(context.filesList);
        const trackedEntriesByPath = new Map(trackedEntries.map(entry => [entry.path, entry]));

        /* TODO: something is wrong with undefined 'check' variable
        if (!rules.includes('node_modules') && !rules.includes('/node_modules') && !rules.includes('/node_modules/*') && !rules.includes('node_modules/*')) {
            !check && context.errors.push(`[E9002] node_modules not found in .npmignore`);
        }
        if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
            !check && context.errors.push(`[E9003] iob_npm.done not found in .gitignore`);
        }
        */

        checkFiles.forEach(file => {
            const trackedEntry = trackedEntriesByPath.get(`/${file}`);
            if (trackedEntry && !isPathIgnoredByRules(trackedEntry.path, trackedEntry.isDirectory, rules)) {
                context.errors.push(`[E9004] file ${file} found in repository, but not found in .gitignore`);
            }
        });

        // Check for .commitinfo file presence
        if (context.filesList.includes('/.commitinfo')) {
            context.errors.push('[E9005] .commitinfo file found in repository, please remove it');
        }

        // Check if .commitinfo is excluded by .gitignore (independent of file presence)
        if (!isPathIgnoredByRules('/.commitinfo', false, rules)) {
            // convert to warning mid of 2026
            context.warnings.push(
                '[S9006] .commitinfo file should be excluded by .gitignore, please add a line with text ".commitinfo" to .gitignore',
            );
        }

        for (const entry of findIgnoredTrackedEntries(trackedEntries, rules)) {
            if (entry.path === '/build' && entry.isDirectory) {
                context.errors.push(
                    '[E9007] build directory is tracked but excluded by .gitignore. Either remove the tracked /build directory from git (if generated) or remove the ignore rule (if intentionally tracked).',
                );
                continue;
            }

            context.warnings.push(
                `[W9008] ${entry.isDirectory ? 'directory' : 'file'} ${entry.path.replace(/^\//, '')} is tracked but covered by .gitignore. Remove from git if generated, or remove the ignore rule if intentionally tracked.`,
            );
        }
    }

    return context;
}

// 950 - 989
async function checkNpmIgnore(context) {
    console.log('\n[E9500 - E9998] checkNpmIgnore');

    // Detect .dev-server directory presence in the repository
    const devServerExistsInRepo = context.filesList.some(
        f => f === '/.dev-server' || f === '/.dev-server/' || f.startsWith('/.dev-server/'),
    );

    const checkFiles = [
        'node_modules/',
        'test/',
        'src/',
        'CHANGELOG_OLD.md',
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

        if (isFileIncludedInFiles('CHANGELOG_OLD.md', context.packageJson.files)) {
            context.warnings.push(
                '[S9508] CHANGELOG_OLD.md is included by package.json "files". Consider excluding it from npm package publishing.',
            );
        }

        // Check that .dev-server directory is not included in package.json "files"
        if (devServerExistsInRepo && isFileIncludedInFiles('.dev-server', context.packageJson.files)) {
            context.errors.push(
                '[E9509] .dev-server directory is included by package.json "files". This development directory must not be published to npm.',
            );
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

            // Check that .dev-server directory is excluded from .npmignore
            if (devServerExistsInRepo) {
                const devServerExcluded = rules.some(rule => {
                    if (typeof rule === 'string') {
                        const normalized = rule.replace(/^\//, '').replace(/\/+$/, '');
                        return normalized === '.dev-server';
                    }
                    return rule.test('.dev-server') || rule.test('.dev-server/');
                });
                if (!devServerExcluded) {
                    context.errors.push(
                        '[E9510] .dev-server directory found in repository but not excluded in .npmignore. This development directory must not be published to npm.',
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
// [9007] build directory found in repository, but excluded by .gitignore
// [9008] tracked file or directory is ignored by .gitignore

// [9010] file ${file} found in repository, but not found in .npmignore.

// [9501] .npmignore found but "files" is used at package.json. Please remove .npmignore.
// [9502] .npmignore not found
// [9503] .npmignore found - consider using package.json object "files" instead.
// [9504] node_modules not found in `.npmignore`
// [9505] iob_npm.done not found in .npmignore` ### removed ###
// [9506] i18n directory excluded by .npmignore
// [9507] i18n directory not included in package.json "files"
// [9508] CHANGELOG_OLD.md included in package.json "files"
// [9509] .dev-server directory included by package.json "files"
// [9510] .dev-server directory not excluded in .npmignore

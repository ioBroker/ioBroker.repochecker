'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Adapter Code
    Numbering   :   5000 - 5499

*/

const fs = require('node:fs');
const path = require('node:path');

const compareVersions = require('compare-versions');
const JSON5 = require('json5');
const yaml = require('js-yaml');

const common = require('./common.js');
const M5500__jsonConfig = require('./M5500__JsonConfig.js');
const M5600__I18n = require('./M5600__I18n.js');

// YAML file extensions for validation
const yamlExtensions = ['.yml', '.yaml'];
const jsonExtensions = ['.json', '.json5'];

// Known Node.js built-in modules (can be used with node: prefix)
const NODE_BUILT_INS = new Set([
    'assert',
    'async_hooks',
    'buffer',
    'child_process',
    'cluster',
    'console',
    'constants',
    'crypto',
    'dgram',
    'diagnostics_channel',
    'dns',
    'domain',
    'events',
    'fs',
    'http',
    'http2',
    'https',
    'inspector',
    'module',
    'net',
    'os',
    'path',
    'perf_hooks',
    'process',
    'punycode',
    'querystring',
    'readline',
    'repl',
    'stream',
    'string_decoder',
    'sys',
    'timers',
    'tls',
    'trace_events',
    'tty',
    'url',
    'util',
    'v8',
    'vm',
    'wasi',
    'worker_threads',
    'zlib',
]);

// utility to parse words.js
function extractWords(words) {
    try {
        const lines = words.split(/\r\n|\r|\n/g);
        let i = 0;
        while (!lines[i].match(/^systemDictionary = {/)) {
            i++;
        }
        lines.splice(0, i);

        // remove last empty lines
        i = lines.length - 1;
        while (!lines[i]) {
            i--;
        }
        if (i < lines.length - 1) {
            lines.splice(i + 1);
        }

        lines[0] = lines[0].replace('systemDictionary = ', '');
        lines[lines.length - 1] = lines[lines.length - 1].trim().replace(/};$/, '}');
        words = lines.join('\n');
        const resultFunc = new Function(`return ${words};`);

        return resultFunc();
    } catch {
        return null;
    }
}

function getAllFiles(context, dirPath, root, filesList) {
    const skipDirectories = ['.dev-server', 'node_modules', '.git', '.vscode'];
    const files = fs.readdirSync(dirPath);
    filesList = filesList || [];
    files.forEach(file => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
            if (!skipDirectories.includes(file)) {
                filesList = getAllFiles(context, path.join(dirPath, file), [root, file].join('/'), filesList);
            }
        } else {
            const filePath = [root, file].join('/');
            filesList.push(filePath);
            if (context.readFiles && context.readFiles.includes(filePath)) {
                context[filePath] = fs.readFileSync(path.join(dirPath, file), 'utf8');
            }
        }
    });
    return filesList;
}

async function getFilesList(context) {
    if (context.filesList) {
        return context;
    }

    if (common.isLocal()) {
        context.filesList = [];
        getAllFiles(context, process.cwd(), '', context.filesList);
    } else {
        context.filesList = await common.getFilesList(context);
    }

    common.debug(``);
    common.debug(`Files cached at context.filesList:`);
    for (const fileName of context.filesList) {
        common.debug(`    ${fileName}`);
    }
    common.debug(``);

    return context;
}

async function loadFiles(context, readFiles) {
    const found = [];
    common.debug(`Loading files...`);
    for (const fileName of context.filesList) {
        if (!common.isLocal() && fileName.match(/^\/node_modules\//) && !found.includes('node_modules')) {
            context.errors.push('[E5000] Directory node_modules found in root of repository. Please delete directory.');
            found.push('node_modules');
        }

        if (readFiles.includes(fileName)) {
            common.debug(`    reading ${fileName}`);
            context[fileName] = await common.getFile(context, fileName);
        } else {
            common.debug(`    SKIPPING ${fileName}`);
        }
    }
}

// E5xx
/**
 * Recursively checks if a key exists anywhere in an object structure.
 * Used to check if an example config key (option1/option2) is used in jsonConfig.
 *
 * @param {object} obj - The object to search
 * @param {string} targetKey - The key to search for
 * @returns {boolean} true if the key is found anywhere in the object
 */
function hasKeyInObject(obj, targetKey) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    if (Object.prototype.hasOwnProperty.call(obj, targetKey)) {
        return true;
    }
    return Object.values(obj).some(val => hasKeyInObject(val, targetKey));
}

/**
 * Checks if a key is used in admin UI files (index.html, index_m.html, or jsonConfig).
 * Used to suppress false-positive example config warnings when the key is intentionally used.
 *
 * @param {object} context - The context object with file contents
 * @param {string} key - The config key to check (e.g. 'option1')
 * @returns {boolean} true if the key is referenced in any admin UI file
 */
function isKeyUsedInAdminConfig(context, key) {
    if (context['/admin/index.html'] && context['/admin/index.html'].includes(key)) {
        return true;
    }
    if (context['/admin/index_m.html'] && context['/admin/index_m.html'].includes(key)) {
        return true;
    }
    const jsonConfigRaw = context['/admin/jsonConfig.json'] || context['/admin/jsonConfig.json5'];
    if (jsonConfigRaw) {
        try {
            const parsed = context['/admin/jsonConfig.json']
                ? JSON.parse(context['/admin/jsonConfig.json'])
                : JSON5.parse(context['/admin/jsonConfig.json5']);
            if (hasKeyInObject(parsed, key)) {
                return true;
            }
        } catch {
            // parse errors are reported elsewhere
        }
    }
    return false;
}

/**
 * Extract the base package name from an import/require path.
 * For scoped packages like @scope/name/subpath -> @scope/name
 * For regular packages like name/subpath -> name
 *
 * @param {string} importPath - The raw import path
 * @returns {string} The base package name
 */
function extractPackageName(importPath) {
    if (importPath.startsWith('@')) {
        // Scoped package: @scope/name/... -> @scope/name
        const parts = importPath.split('/');
        return parts.slice(0, 2).join('/');
    }
    // Regular package: name/... -> name
    return importPath.split('/')[0];
}

/**
 * Recursively collect native keys used by jsonConfig password components.
 * Password components inside a table are ignored because table encryption is not available.
 *
 * @param {any} node - Current json node
 * @param {Map<string, Set<string>>} passwordLocations - native key -> set of locations
 * @param {object} options - recursion state
 * @param {string} options.filePath - admin file path
 * @param {string} options.pathInFile - current path in json object
 * @param {boolean} options.inTable - whether recursion currently is inside a table component
 * @param {string | undefined} options.itemKey - item key from parent "items" object
 */
function collectJsonConfigPasswordFields(node, passwordLocations, options) {
    if (!node || typeof node !== 'object') {
        return;
    }

    if (Array.isArray(node)) {
        node.forEach((entry, index) =>
            collectJsonConfigPasswordFields(entry, passwordLocations, {
                ...options,
                pathInFile: `${options.pathInFile}[${index}]`,
                itemKey: undefined,
            }),
        );
        return;
    }

    const nodeType = typeof node.type === 'string' ? node.type : undefined;
    const insideTable = options.inTable || nodeType === 'table';

    if (nodeType === 'password' && !insideTable) {
        const nativeKey =
            typeof node.attr === 'string' && node.attr.trim()
                ? node.attr.trim()
                : typeof options.itemKey === 'string'
                  ? options.itemKey
                  : undefined;

        if (nativeKey) {
            if (!passwordLocations.has(nativeKey)) {
                passwordLocations.set(nativeKey, new Set());
            }
            passwordLocations.get(nativeKey).add(`${options.filePath}:${options.pathInFile}`);
        }
    }

    if (node.items && typeof node.items === 'object' && !Array.isArray(node.items)) {
        for (const [itemKey, itemValue] of Object.entries(node.items)) {
            collectJsonConfigPasswordFields(itemValue, passwordLocations, {
                ...options,
                pathInFile: `${options.pathInFile}/items/${itemKey}`,
                inTable: insideTable,
                itemKey,
            });
        }
    }

    for (const [key, value] of Object.entries(node)) {
        if (key === 'items') {
            continue;
        }
        collectJsonConfigPasswordFields(value, passwordLocations, {
            ...options,
            pathInFile: `${options.pathInFile}/${key}`,
            inTable: insideTable,
            itemKey: undefined,
        });
    }
}

/**
 * Recursively collect table/accordion components that define encryptedAttributes.
 * These components require js-controller >= 7.0.7 for encrypted array element support.
 *
 * @param {*} node - Current JSON node to inspect
 * @param {string[]} locations - Array to collect "filePath:pathInFile" strings
 * @param {{ filePath: string, pathInFile: string }} options - Context for the current node
 */
function collectJsonConfigEncryptedAttributeComponents(node, locations, options) {
    if (!node || typeof node !== 'object') {
        return;
    }

    if (Array.isArray(node)) {
        node.forEach((entry, index) =>
            collectJsonConfigEncryptedAttributeComponents(entry, locations, {
                ...options,
                pathInFile: `${options.pathInFile}[${index}]`,
            }),
        );
        return;
    }

    const nodeType = typeof node.type === 'string' ? node.type : undefined;

    if (
        (nodeType === 'table' || nodeType === 'accordion') &&
        Array.isArray(node.encryptedAttributes) &&
        node.encryptedAttributes.length > 0
    ) {
        locations.push(`${options.filePath}:${options.pathInFile}`);
    }

    for (const [key, value] of Object.entries(node)) {
        collectJsonConfigEncryptedAttributeComponents(value, locations, {
            ...options,
            pathInFile: `${options.pathInFile}/${key}`,
        });
    }
}

/**
 * Strip single-line and block comments from source code content.
 * This is a best-effort approach: it handles the common cases but does not
 * account for comment-like sequences inside string literals.
 *
 * @param {string} content - Source file content
 * @returns {string} Content with comments removed
 */
function stripComments(content) {
    // Remove block comments (/* ... */)
    let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove single-line comments (// ...)
    result = result.replace(/\/\/[^\n]*/g, '');
    return result;
}

/**
 * Strip string literals and comments while preserving line positions.
 * Used for API method detection to avoid false positives in comments/log strings.
 *
 * @param {string} content - Source file content
 * @returns {string} Sanitized content
 */
function stripStringsAndCommentsPreserveLines(content) {
    let result = content;

    // Strip string literals first so comment markers inside strings are ignored
    result = result.replace(/'([^'\\\r\n]|\\.)*'/g, match => `'${' '.repeat(match.length - 2)}'`);
    result = result.replace(/"([^"\\\r\n]|\\.)*"/g, match => `"${' '.repeat(match.length - 2)}"`);
    result = result.replace(/`(?:[^`\\]|\\.)*`/g, match => `\`${match.slice(1, -1).replace(/[^\n]/g, ' ')}\``);

    // Strip comments while preserving newline positions
    result = result.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '));
    result = result.replace(/\/\/[^\n\r]*/g, match => ' '.repeat(match.length));

    return result;
}

/**
 * Extract all require/import targets from source file content.
 *
 * @param {string} content - File content
 * @returns {string[]} Array of unique import targets
 */
function extractImports(content) {
    const imports = new Set();

    // Strip comments first to avoid matching require/import patterns inside comments
    const code = stripComments(content);

    // require('...') or require("...") or require(`...`)
    const requirePattern = /\brequire\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g;
    let match;
    while ((match = requirePattern.exec(code)) !== null) {
        common.debug(`    require:     found ${match[1]}`);
        imports.add(match[1]);
    }

    // import ... from '...' (handles multi-line imports too)
    // Requires 'import' keyword before 'from' to avoid matching
    // 'from' in log messages, strings, or other non-import contexts.
    // Non-greedy [\s\S]*? always stops at the nearest 'from', so consecutive
    // import statements are each matched independently.
    // The negative lookahead (?!\s*\() excludes dynamic imports like import("pkg")
    // which would otherwise span many lines and falsely match 'from' in string literals.
    // The negative lookahead (?!\s+type\b) excludes TypeScript type-only imports like
    // `import type { Foo } from 'pkg'` which do not require runtime dependencies.
    const fromPattern = /\b(?:import)\b(?!\s*\()(?!\s+type\b)[\s\S]*?\bfrom\s+['"`]([^'"`\n]+)['"`]/g;
    while ((match = fromPattern.exec(code)) !== null) {
        common.debug(`    import from: found ${match[1]}`);
        imports.add(match[1]);
    }

    // Side-effect imports: import 'package'
    const sideEffectImportPattern = /\bimport\s+['"`]([^'"`\n]+)['"`]/g;
    while ((match = sideEffectImportPattern.exec(code)) !== null) {
        common.debug(`    import ...:  found ${match[1]}`);
        imports.add(match[1]);
    }

    // dynamic import('...')
    const dynamicImportPattern = /\bimport\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g;
    while ((match = dynamicImportPattern.exec(code)) !== null) {
        common.debug(`    dyn import:  found ${match[1]}`);
        imports.add(match[1]);
    }

    return [...imports];
}

function analyzeJsonFormatting(content, isJson5File) {
    const issues = [];
    const lines = content.split(/\r?\n/);
    let isInsideJson5BlockComment = false;

    let hasTabIndent = false;
    let hasSpaceIndent = false;
    let hasMixedIndentLine = false;
    const spaceIndentLengths = [];
    let maxRelevantLineLength = 0;
    let relevantLineCount = 0;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            continue;
        }
        if (isJson5File) {
            if (isInsideJson5BlockComment) {
                if (trimmedLine.includes('*/')) {
                    isInsideJson5BlockComment = false;
                }
                continue;
            }
            if (trimmedLine.startsWith('//')) {
                continue;
            }
            if (trimmedLine.startsWith('/*')) {
                if (!trimmedLine.includes('*/')) {
                    isInsideJson5BlockComment = true;
                }
                continue;
            }
        }

        relevantLineCount++;
        maxRelevantLineLength = Math.max(maxRelevantLineLength, line.length);

        const indentMatch = line.match(/^([ \t]+)/);
        if (!indentMatch) {
            continue;
        }
        const indent = indentMatch[1];
        const usesTabs = indent.includes('\t');
        const usesSpaces = indent.includes(' ');
        hasTabIndent = hasTabIndent || usesTabs;
        hasSpaceIndent = hasSpaceIndent || usesSpaces;
        hasMixedIndentLine = hasMixedIndentLine || (usesTabs && usesSpaces);

        if (!usesTabs) {
            spaceIndentLengths.push(indent.length);
        }
    }

    if (hasMixedIndentLine || (hasTabIndent && hasSpaceIndent)) {
        issues.push('mixed indentation');
    } else if (!hasTabIndent && spaceIndentLengths.length) {
        const uses2SpaceStyle = spaceIndentLengths.every(indent => indent % 2 === 0);
        const uses4SpaceStyle = spaceIndentLengths.every(indent => indent % 4 === 0);
        if (!uses2SpaceStyle && !uses4SpaceStyle) {
            issues.push('inconsistent indentation');
        }
    }

    const sanitizedContent = stripStringsAndCommentsPreserveLines(content);
    const structuralTokenCount = (sanitizedContent.match(/[{}[\],]/g) || []).length;
    const looksMinified =
        (relevantLineCount <= 1 && structuralTokenCount >= 8) ||
        (relevantLineCount <= 3 && structuralTokenCount >= 20 && maxRelevantLineLength >= 160);
    if (looksMinified) {
        issues.push('too few line breaks');
    }

    return issues;
}

async function checkCode(context) {
    console.log('\n[E5000 - E5999] checkCode');

    const readFiles = [
        '/.npmignore',
        '/.gitignore',
        '/iob_npm.done',
        '/.travis.yml',
        '/gulpfile.js',
        '/.releaseconfig.json',

        // Add all potential files anyway. If they exist, they must be valid.
        // If they are unnecessary, a warning could be issued
        '/admin/index.html',
        '/admin/index_m.html',
        '/admin/words.js',
        '/admin/jsonConfig.json',
        '/admin/jsonConfig.json5',
        '/admin/jsonCustom.json',
        '/admin/jsonCustom.json5',
        '/admin/jsonTab.json',
        '/admin/jsonTab.json5',
        '/admin/blockly.js',
        '/admin/custom.html',
        '/admin/custom_m.html',

        '/src-admin/package.json', // check if react is used
        '/src-widgets/package.json', // check if react is used
        '/src/package.json', // check if react is used

        '/tsconfig.json', // read to extract path aliases (pseudo-organisations)
    ];

    context.cfg.allowedLanguages.forEach(lang => readFiles.push(`/admin/i18n/${lang}/translations.json`));

    context.cfg.allowedLanguages.forEach(lang => readFiles.push(`/admin/i18n/${lang}.json`));

    if (context.packageJson.main) {
        readFiles.push(`/${context.packageJson.main}`);
    }

    // Add all executable files to readFiles for proper lib/tools.js usage scanning
    // We need to discover files first to know which ones to read
    // await getFilesList(context); // redundant call
    const tempFilesList = context.filesList;

    // Add all executable files (.js, .mjs, .cjs, .ts) to readFiles, excluding certain directories
    const executableExtensions = ['.js', '.mjs', '.cjs', '.ts'];
    const excludeDirsForExecutables = [
        'node_modules',
        'admin',
        'admin-src',
        'doc',
        'docs',
        '.git',
        '.vscode',
        '.dev-server',
    ];

    tempFilesList.forEach(filePath => {
        // Skip files in excluded directories
        const pathParts = filePath.split('/').filter(part => part !== '');
        const isInExcludedDir = pathParts.some(part => excludeDirsForExecutables.includes(part));

        if (!isInExcludedDir) {
            const ext = path.extname(filePath);
            if (executableExtensions.includes(ext)) {
                // Ensure the file path starts with /
                const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
                if (!readFiles.includes(normalizedPath)) {
                    readFiles.push(normalizedPath);
                }
            }
        }
    });

    // Add all JSON files (.json, .json5) to readFiles for formatting validation
    const excludeDirsForJson = ['node_modules', '.git', '.vscode', '.dev-server'];

    tempFilesList.forEach(filePath => {
        const pathParts = filePath.split('/').filter(part => part !== '');
        const isInExcludedDir = pathParts.some(part => excludeDirsForJson.includes(part));

        if (!isInExcludedDir) {
            const ext = path.extname(filePath);
            if (jsonExtensions.includes(ext)) {
                const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
                if (!readFiles.includes(normalizedPath)) {
                    readFiles.push(normalizedPath);
                }
            }
        }
    });

    // Add all YAML files (.yml, .yaml) to readFiles for validation
    const excludeDirsForYaml = ['node_modules', '.git', '.vscode', '.dev-server'];

    tempFilesList.forEach(filePath => {
        // Skip files in excluded directories
        const pathParts = filePath.split('/').filter(part => part !== '');
        const isInExcludedDir = pathParts.some(part => excludeDirsForYaml.includes(part));

        if (!isInExcludedDir) {
            const ext = path.extname(filePath);
            if (yamlExtensions.includes(ext)) {
                // Ensure the file path starts with /
                const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
                if (!readFiles.includes(normalizedPath)) {
                    readFiles.push(normalizedPath);
                }
            }
        }
    });

    // Add all i18n translation files discovered across the entire repository tree
    M5600__I18n.getI18nFilesToRead(tempFilesList).forEach(filePath => {
        const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        if (!readFiles.includes(normalizedPath)) {
            readFiles.push(normalizedPath);
        }
    });

    //    if (!context.ioPackageJson.common.noConfig) {
    //        if (context.ioPackageJson.common.materialize || (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'materialize')) {
    //            readFiles.push('admin/index_m.html');
    //            readFiles.push('admin/words.js');
    //        }
    //
    //        if (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'json') {
    //            readFiles.push('admin/jsonConfig.json');
    //            readFiles.push('admin/jsonConfig.json5');
    //            allowedLanguages.forEach(lang =>
    //                readFiles.push(`admin/i18n/${lang}/translations.json`));
    //            allowedLanguages.forEach(lang =>
    //                readFiles.push(`admin/i18n/${lang}.json`));
    //        }
    //
    //        if (context.ioPackageJson.common.supportCustoms || context.ioPackageJson.common.jsonCustom || (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.custom === 'json')) {
    //            readFiles.push('admin/jsonCustom.json');
    //            readFiles.push('admin/jsonCustom.json5');
    //        }
    //    }
    //
    //    if (context.ioPackageJson.common.blockly) {
    //        readFiles.push('admin/blockly.js');
    //    }

    // https://github.com/userName/ioBroker.adaptername/archive/${context.branch}.zip

    await loadFiles(context, readFiles);

    // E5040: Check native example keys (option1/option2) found in io-package.json native.
    // Only raise error if the keys are not actually used in admin UI files (index.html, index_m.html, or jsonConfig).
    if (context.nativeExampleKeys && context.nativeExampleKeys.length && !context.hasExampleConfigWarning) {
        const unusedNativeKeys = context.nativeExampleKeys.filter(key => !isKeyUsedInAdminConfig(context, key));
        if (unusedNativeKeys.length) {
            const keyList = unusedNativeKeys.join(', ');
            context.errors.push(
                `[E5040] Example configuration (${keyList}) found in "native" of io-package.json. Please remove example configuration from your code.`,
            );
            context.hasExampleConfigWarning = true;
        }
    }

    // W5041: Check i18n translation files for example keys (option1/option2).
    // Only raise warning if the keys are not actually used in admin UI files (index.html, index_m.html, or jsonConfig).
    if (!context.hasExampleConfigWarning) {
        const exampleKeys = ['option1', 'option2'];
        const foundI18nKeys = new Set();
        const foundI18nLangs = new Set();
        for (const lang of context.cfg.allowedLanguages) {
            for (const i18nPath of [`/admin/i18n/${lang}/translations.json`, `/admin/i18n/${lang}.json`]) {
                if (context[i18nPath]) {
                    try {
                        const i18nContent = JSON.parse(context[i18nPath]);
                        const unusedI18nKeys = exampleKeys.filter(
                            key =>
                                Object.prototype.hasOwnProperty.call(i18nContent, key) &&
                                !isKeyUsedInAdminConfig(context, key),
                        );
                        for (const key of unusedI18nKeys) {
                            foundI18nKeys.add(key);
                        }
                        if (unusedI18nKeys.length) {
                            foundI18nLangs.add(lang);
                        }
                    } catch {
                        // parse errors are reported elsewhere
                    }
                }
            }
        }
        if (foundI18nKeys.size) {
            const keyList = [...foundI18nKeys].join(', ');
            const langList = [...foundI18nLangs].join(', ');
            context.warnings.push(
                `[W5041] Example configuration (${keyList}) found in i18n translation files (${langList}). Please remove example configuration from your code.`,
            );
            context.hasExampleConfigWarning = true;
        }
    }

    // Check for conflicting JavaScript file extensions in the same directory
    // W5034: Files with the same base name but different extensions (.ts, .js, .cjs, .mjs) in the same directory
    const jsExtensions = ['.ts', '.js', '.cjs', '.mjs'];
    const filesByDirectory = new Map();

    // Group files by directory and base name
    context.filesList.forEach(filePath => {
        const ext = path.extname(filePath);
        if (jsExtensions.includes(ext)) {
            const dir = path.dirname(filePath);
            const baseName = path.basename(filePath, ext);

            if (!filesByDirectory.has(dir)) {
                filesByDirectory.set(dir, new Map());
            }

            const dirFiles = filesByDirectory.get(dir);
            if (!dirFiles.has(baseName)) {
                dirFiles.set(baseName, []);
            }

            dirFiles.get(baseName).push({ ext, fullPath: filePath });
        }
    });

    // Check for conflicts
    filesByDirectory.forEach((dirFiles, dir) => {
        dirFiles.forEach(files => {
            if (files.length > 1) {
                const filePaths = files
                    .map(f => f.fullPath)
                    .sort()
                    .join(', ');
                context.warnings.push(
                    `[W5034] Files with conflicting extensions found in directory "${dir}": ${filePaths} - Only one JavaScript/TypeScript file extension (.ts, .js, .cjs, or .mjs) should be used per file name.`,
                );
            }
        });
    });

    // Check for conflicting JSON file extensions in the same directory
    // E5038: Files with the same base name but different extensions (.json, .json5) in the same directory
    const jsonFilesByDirectory = new Map();

    // Group files by directory and base name
    context.filesList.forEach(filePath => {
        const ext = path.extname(filePath);
        if (jsonExtensions.includes(ext)) {
            const dir = path.dirname(filePath);
            const baseName = path.basename(filePath, ext);

            if (!jsonFilesByDirectory.has(dir)) {
                jsonFilesByDirectory.set(dir, new Map());
            }

            const dirFiles = jsonFilesByDirectory.get(dir);
            if (!dirFiles.has(baseName)) {
                dirFiles.set(baseName, []);
            }

            dirFiles.get(baseName).push({ ext, fullPath: filePath });
        }
    });

    // Check for JSON/JSON5 conflicts
    jsonFilesByDirectory.forEach((dirFiles, dir) => {
        dirFiles.forEach((files, baseName) => {
            if (files.length > 1) {
                // Check if we have both .json and .json5 extensions
                const hasJson = files.some(f => f.ext === '.json');
                const hasJson5 = files.some(f => f.ext === '.json5');
                if (hasJson && hasJson5) {
                    context.errors.push(
                        `[E5038] Conflicting JSON files in directory "${dir}": Both ${baseName}.json and ${baseName}.json5 versions of same file exist. Please remove one.`,
                    );
                }
            }
        });
    });

    // Check all YAML files (.yml, .yaml) for valid syntax
    // E5035: YAML file cannot be parsed
    for (const fileName of Object.keys(context)) {
        if (fileName.startsWith('/') && typeof context[fileName] === 'string') {
            const ext = path.extname(fileName);
            if (yamlExtensions.includes(ext)) {
                try {
                    yaml.load(context[fileName]);
                } catch (e) {
                    context.errors.push(
                        `[E5035] Cannot parse YAML file "${fileName.slice(1)}": ${e.message.split('\n')[0]}`,
                    );
                }
            }
        }
    }

    // Check selected JSON and JSON5 files for human-readable formatting
    for (const fileName of Object.keys(context)) {
        if (fileName.startsWith('/') && typeof context[fileName] === 'string') {
            const ext = path.extname(fileName);
            const isRelevantJsonFile =
                fileName === '/package.json' ||
                fileName === '/io-package.json' ||
                /^\/admin\/[^/]+\.(json|json5)$/i.test(fileName);
            if (jsonExtensions.includes(ext) && isRelevantJsonFile) {
                const isJson5File = ext === '.json5';
                const issues = analyzeJsonFormatting(context[fileName], isJson5File);
                if (issues.length) {
                    context.warnings.push(
                        `[W5063] JSON formatting in "${fileName.slice(1)}" is hard to read (${issues.join(
                            ', ',
                        )}). Please use consistent indentation and proper line breaks.`,
                    );
                }
            }
        }
    }

    let usesReact = false;
    if (
        context.packageJson.devDependencies &&
        (context.packageJson.devDependencies['@iobroker/adapter-react-v5'] ||
            context.packageJson.devDependencies['react'])
    ) {
        common.info('REACT detected at package devDependencies');
        usesReact = true;
    }
    if (
        context.packageJson.dependencies &&
        (context.packageJson.dependencies['@iobroker/adapter-react-v5'] || context.packageJson.dependencies['react'])
    ) {
        common.info('REACT detected at package dependencies');
        usesReact = true;
    }
    if (context['/src-admin/package.json']) {
        const packageJson = JSON.parse(context['/src-admin/package.json']);
        if (packageJson.devDependencies && packageJson.devDependencies['@iobroker/adapter-react-v5']) {
            common.info('REACT detected at src-admin/package devDependencies');
            usesReact = true;
        }
        if (packageJson.dependencies && packageJson.dependencies['@iobroker/adapter-react-v5']) {
            common.info('REACT detected at src-admin/package dependencies');
            usesReact = true;
        }
    }
    if (context['/src-widgets/package.json']) {
        const packageJson = JSON.parse(context['/src-widgets/package.json']);
        if (
            packageJson.devDependencies &&
            (packageJson.devDependencies['@iobroker/adapter-react-v5'] || packageJson.devDependencies['react'])
        ) {
            common.info('REACT detected at src-widgets/package devDependencies');
            usesReact = true;
        }
        if (
            packageJson.dependencies &&
            (packageJson.dependencies['@iobroker/adapter-react-v5'] || packageJson.dependencies['react'])
        ) {
            common.info('REACT detected at src-widgets/package dependencies');
            usesReact = true;
        }
    }
    if (context['/src/package.json']) {
        //console.log('"src/package.json" exists');
        const packageJson = JSON.parse(context['/src/package.json']);
        if (packageJson.devDependencies && packageJson.devDependencies['@iobroker/adapter-react-v5']) {
            // console.log('REACT detected');
            usesReact = true;
        }
        if (packageJson.dependencies && packageJson.dependencies['@iobroker/adapter-react-v5']) {
            // console.log('REACT detected');
            usesReact = true;
        }
    }

    if (
        !usesReact &&
        !context.ioPackageJson.common.noConfig &&
        (!context.ioPackageJson.common.adminUI ||
            (context.ioPackageJson.common.adminUI.config !== 'json' &&
                context.ioPackageJson.common.adminUI.config !== 'none'))
    ) {
        context.warnings.push('[S5022] Please consider migrating to admin 5 UI (jsonConfig) or react based UI.');
    }

    if (
        context.ioPackageJson.common.materialize ||
        (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'materialize')
    ) {
        if (
            context['/admin/index_m.html'] &&
            context['/admin/index_m.html'].includes('selectID.js') &&
            !context.filesList.includes('/admin/img/info-big.png')
        ) {
            context.errors.push('[E5002] "/admin/img/info-big.png" not found, but selectID.js used in index_m.html ');
        }

        if (context['/admin/words.js']) {
            // at least 3 languages must be in
            const words = extractWords(context['/admin/words.js']);
            if (words) {
                const problem = Object.keys(words).filter(word => !words[word].de || !words[word].ru);
                if (problem.length > 3) {
                    context.errors.push(
                        `[E5006] More non translated in german or russian words found in admin/words.js. You can use https://translator.iobroker.in/ for translations`,
                    );
                } else {
                    problem.forEach(word => {
                        if (!words[word].de) {
                            context.errors.push(
                                `[E5006] Word "${word}" is not translated to german in admin/words.js. You can use https://translator.iobroker.in/ for translations`,
                            );
                        }
                        if (!words[word].ru) {
                            context.errors.push(
                                `[E5006] Word "${word}" is not translated to russian in admin/words.js. You can use https://translator.iobroker.in/ for translations`,
                            );
                        }
                    });
                }
            }
        } else {
            context.checks.push('admin/words.js found.');
        }

        // // Check if admin/index.html exists but materialize is used (W5055)
        // // admin/index.html is for admin2, which is not needed when materialize is used
        // if (context.filesList.includes('/admin/index.html')) {
        //     context.warnings.push(
        //         '[W5055] "admin/index.html" found but materialize is used. This file is for admin2 (old UI) and is outdated. Please consider removing it.',
        //     );
        // }
    }

    // Check if admin/custom.html or admin/custom_m.html exists - these are no longer supported (W5056)
    const obsoleteCustomHtmlFiles = ['/admin/custom.html', '/admin/custom_m.html'];
    for (const file of obsoleteCustomHtmlFiles) {
        if (context.filesList.includes(file)) {
            context.warnings.push(
                `[W5056] "${file.replace(/^\//, '')}" is no longer supported. Please migrate to "admin/jsonCustom.json".`,
            );
        }
    }

    if (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'json') {
        let jsonConfig;
        if (context['/admin/jsonConfig.json'] || context['/admin/jsonConfig.json5']) {
            try {
                jsonConfig = context['/admin/jsonConfig.json']
                    ? JSON.parse(context['/admin/jsonConfig.json'])
                    : JSON5.parse(context['/admin/jsonConfig.json5']);
            } catch (e) {
                context.errors.push(
                    `[E5007] Cannot parse "/admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}": ${e}`,
                );
            }
        } else {
            context.errors.push(
                `[E5008] "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}" not found, but admin support is declared`,
            );
        }

        if (jsonConfig) {
            // Resolve the i18n directory: default is admin/i18n, but may be overridden by a string attribute
            // Note that i18n value is relative to the location of jsonConfig
            const i18nAttr = jsonConfig.i18n;
            const i18nDir =
                typeof i18nAttr === 'string' && i18nAttr.trim() !== '' ? `/admin/${i18nAttr.trim()}` : '/admin/i18n';

            if (i18nAttr === true || typeof i18nAttr === 'string') {
                context.cfg.allowedLanguages.forEach(lang => {
                    if (context[`${i18nDir}/${lang}/translations.json`]) {
                        try {
                            JSON.parse(context[`${i18nDir}/${lang}/translations.json`]);
                        } catch (e) {
                            context.errors.push(
                                `[E5009] Cannot parse "${i18nDir.replace(/^\//, '')}/${lang}/translations.json": ${e}`,
                            );
                        }
                    } else if (context[`${i18nDir}/${lang}.json`]) {
                        try {
                            JSON.parse(context[`${i18nDir}/${lang}.json`]);
                        } catch (e) {
                            context.errors.push(
                                `[E5009] Cannot parse "${i18nDir.replace(/^\//, '')}/${lang}.json": ${e}`,
                            );
                        }
                    } else {
                        context.errors.push(
                            `[E5010] "${i18nDir.replace(/^\//, '')}/${lang}/translations.json" or "${i18nDir.replace(/^\//, '')}/${lang}.json" not found, but admin support is declared. Please add.`,
                        );
                    }
                });
            } else if (i18nAttr === false) {
                context.warnings.push(`[W5015] Why did you decide to disable i18n support?`);
            } else {
                context.warnings.push(`[W5022] Why did you decide not to use i18n support?`);
            }

            M5500__jsonConfig.checkJsonConfig(
                context,
                `admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}`,
                jsonConfig,
            );
        } // if (jsonConfig) ...
    }

    // Check for outdated admin/words.js when jsonConfig is used (W5039)
    if (
        context.ioPackageJson.common.adminUI &&
        context.ioPackageJson.common.adminUI.config === 'json' &&
        context.filesList.includes('/admin/words.js')
    ) {
        common.debug('/admin/words.js detected while jsonConfig is used.');
        let isWordsJsUsed = false;

        const excludeFiles = [
            '/admin/words.js',
            '/eslint.config.js',
            '/eslint.config.cjs',
            '/eslint.config.mjs',
            '/.eslintignore',
            '/.create-adapter.json',
        ];
        for (const fileName of Object.keys(context)) {
            if (fileName.startsWith('/') && typeof context[fileName] === 'string' && !excludeFiles.includes(fileName)) {
                const content = context[fileName];
                // Detect references to words.js in various forms:
                // - Direct file name: words.js (e.g. in HTML script tags)
                // - Path-prefixed: ./words, ../words, admin/words (with or without .js extension)
                // - Bare name in import/require: require('words'), import ... from 'words'
                if (
                    content.includes('words.js') ||
                    /['"`](?:\.\/|\.\.\/|admin\/)words(?:\.js)?['"`]/.test(content) ||
                    /require\s*\(\s*['"`]words['"`]\s*\)/.test(content) ||
                    /(?:import|from)\s+['"`]words['"`]/.test(content)
                ) {
                    common.debug(`/admin.words.js used by ${fileName}`);
                    isWordsJsUsed = true;
                    break;
                }
            }
        }

        if (!isWordsJsUsed) {
            context.warnings.push(
                '[W5039] "admin/words.js" found but not referenced anywhere. File seems to be outdated, please consider removing it.',
            );
        }
    }

    // Check if admin/jsonConfig.json or admin/jsonConfig.json5 exists but common.adminUI.config is not set to "json" (W5046)
    if (
        (context.filesList.includes('/admin/jsonConfig.json') ||
            context.filesList.includes('/admin/jsonConfig.json5')) &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'json')
    ) {
        context.warnings.push(
            '[W5046] Using admin/jsonConfig.json(5) requires common.adminUI.config to be set to "json".',
        );
    }

    // Check for obsolete admin files (index.html, index_m.html, style.css) when jsonConfig is used (W5047)
    if (
        context.ioPackageJson.common.adminUI &&
        context.ioPackageJson.common.adminUI.config === 'json' &&
        (context.filesList.includes('/admin/jsonConfig.json') || context.filesList.includes('/admin/jsonConfig.json5'))
    ) {
        const obsoleteFiles = ['/admin/index.html', '/admin/index_m.html', '/admin/style.css'];
        for (const file of obsoleteFiles) {
            if (context.filesList.includes(file)) {
                context.warnings.push(
                    `[W5047] "${file.replace(/^\//, '')}" is most likely outdated since jsonConfig is used. Please consider removing it.`,
                );
            }
        }
    }

    if (
        context.ioPackageJson.common.supportCustoms ||
        context.ioPackageJson.common.jsonCustom ||
        (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.custom === 'json')
    ) {
        if (context['/admin/jsonCustom.json'] || context['/admin/jsonCustom.json5']) {
            try {
                context['/admin/jsonCustom.json']
                    ? JSON.parse(context['/admin/jsonCustom.json'])
                    : JSON5.parse(context['/admin/jsonCustom.json5']);
            } catch (e) {
                context.errors.push(
                    `[E5011] Cannot parse "/admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}": ${e}`,
                );
            }
        } else {
            context.errors.push(
                `[E5012] Neither "/admin/jsonCustom.json" nor "/admin/jsonCustom.json5" found, but custom support is declared`,
            );
        }
    }

    // Check if admin/jsonCustom.json(5) exists but custom support is NOT declared (W5053)
    if (
        (context.filesList.includes('/admin/jsonCustom.json') ||
            context.filesList.includes('/admin/jsonCustom.json5')) &&
        !context.ioPackageJson.common.supportCustoms &&
        !context.ioPackageJson.common.jsonCustom &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.custom === 'json')
    ) {
        context.warnings.push(
            `[W5053] "admin/jsonCustom.json${context.filesList.includes('/admin/jsonCustom.json') ? '' : '5'}" found but custom support is not declared in io-package.json. Consider removing the file or declaring custom support.`,
        );
    }

    if (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.tab === 'json') {
        if (context['/admin/jsonTab.json'] || context['/admin/jsonTab.json5']) {
            try {
                context['/admin/jsonTab.json']
                    ? JSON.parse(context['/admin/jsonTab.json'])
                    : JSON5.parse(context['/admin/jsonTab.json5']);
            } catch (e) {
                context.errors.push(
                    `[E5044] Cannot parse "/admin/jsonTab.json${context['/admin/jsonTab.json'] ? '' : '5'}": ${e}`,
                );
            }
        } else {
            context.errors.push(
                `[E5045] "/admin/jsonTab.json${context['/admin/jsonTab.json'] ? '' : '5'}" not found, but tab support is declared`,
            );
        }
    }

    // Check if admin/jsonTab.json or admin/jsonTab.json5 exists but common.adminUI.tab is not set to "json" (W5064)
    if (
        (context.filesList.includes('/admin/jsonTab.json') || context.filesList.includes('/admin/jsonTab.json5')) &&
        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.tab === 'json')
    ) {
        context.warnings.push('[W5064] Using admin/jsonTab.json(5) requires common.adminUI.tab to be set to "json".');
    }

    // Validate all present jsonConfig files against the jsonConfig schema
    const jsonConfigFilesToValidate = [
        '/admin/jsonConfig.json',
        '/admin/jsonCustom.json',
        '/admin/jsonTab.json',
        '/admin/jsonConfig.json5',
        '/admin/jsonCustom.json5',
        '/admin/jsonTab.json5',
    ];

    for (const configFile of jsonConfigFilesToValidate) {
        if (context[configFile]) {
            let parsed;
            try {
                parsed = configFile.endsWith('.json5')
                    ? JSON5.parse(context[configFile])
                    : JSON.parse(context[configFile]);
            } catch (e) {
                common.debug(`Could not parse ${configFile} for schema validation: ${e.message}`);
                context.warnings.push(
                    `[W5515] Schema validation skipped for "${configFile.replace(/^\//, '')}" due to parse error: ${e.message}`,
                );
            }
            if (parsed) {
                await M5500__jsonConfig.validateJsonConfigSchema(context, configFile.replace(/^\//, ''), parsed);
            }
        }
    }

    // Check password fields in admin jsonConfig files against protectedNative and encryptedNative
    if (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'json') {
        const protectedNative = new Set(
            Array.isArray(context.ioPackageJson.protectedNative) ? context.ioPackageJson.protectedNative : [],
        );
        const encryptedNative = new Set(
            Array.isArray(context.ioPackageJson.encryptedNative) ? context.ioPackageJson.encryptedNative : [],
        );
        const passwordLocations = new Map();

        for (const adminFile of context.filesList) {
            if (!/^\/admin\/.+\.json5?$/.test(adminFile) || typeof context[adminFile] !== 'string') {
                continue;
            }

            try {
                const parsed = adminFile.endsWith('.json5')
                    ? JSON5.parse(context[adminFile])
                    : JSON.parse(context[adminFile]);
                collectJsonConfigPasswordFields(parsed, passwordLocations, {
                    filePath: adminFile.replace(/^\//, ''),
                    pathInFile: '$',
                    inTable: false,
                    itemKey: undefined,
                });
            } catch (e) {
                common.debug(`Skipping password field scan for ${adminFile}: ${e.message}`);
            }
        }

        for (const [nativeKey, locations] of passwordLocations.entries()) {
            const locationList = [...locations].join(', ');
            if (!protectedNative.has(nativeKey)) {
                context.warnings.push(
                    `[W5057] jsonConfig password field "${nativeKey}" (${locationList}) is not listed at "protectedNative" in io-package.json`,
                );
            }
            if (!encryptedNative.has(nativeKey)) {
                context.warnings.push(
                    `[W5058] jsonConfig password field "${nativeKey}" (${locationList}) is not listed at "encryptedNative" in io-package.json`,
                );
            }
        }
    }

    // Check for table/accordion components with encryptedAttributes requiring js-controller >= 7.0.7
    if (
        context.ioPackageJson.common &&
        context.ioPackageJson.common.adminUI &&
        context.ioPackageJson.common.adminUI.config === 'json'
    ) {
        const encryptedAttrLocations = [];

        for (const adminFile of context.filesList) {
            if (!/^\/admin\/.+\.json5?$/.test(adminFile) || typeof context[adminFile] !== 'string') {
                continue;
            }

            try {
                const parsed = adminFile.endsWith('.json5')
                    ? JSON5.parse(context[adminFile])
                    : JSON.parse(context[adminFile]);
                collectJsonConfigEncryptedAttributeComponents(parsed, encryptedAttrLocations, {
                    filePath: adminFile.replace(/^\//, ''),
                    pathInFile: '$',
                });
            } catch (e) {
                common.debug(`Skipping encryptedAttributes scan for ${adminFile}: ${e.message}`);
            }
        }

        if (encryptedAttrLocations.length > 0) {
            const requiredVersion = '7.0.7';
            const currentVersion = context.currentJsControllerVersion;
            // Only warn when a js-controller version is declared but is below the required minimum.
            // When the dependency is missing entirely, E1062 from M1000 already covers that case.
            if (currentVersion && compareVersions.compare(requiredVersion, currentVersion, '>')) {
                const locationList = encryptedAttrLocations.join(', ');
                context.warnings.push(
                    `[W5062] jsonConfig uses "encryptedAttributes" in table/accordion (${locationList}). js-controller >= ${requiredVersion} is required for encrypted object support.`,
                );
            }
        }
    }

    if (context.ioPackageJson.common.blockly && !context['/admin/blockly.js']) {
        context.errors.push('[E5014] "/admin/blockly.js" not found, but blockly support is declared');
    }

    // Check if admin/blockly.js exists but blockly support is NOT declared (W5054)
    if (!context.ioPackageJson.common.blockly && context.filesList.includes('/admin/blockly.js')) {
        context.warnings.push(
            '[W5054] "admin/blockly.js" found but blockly support is not declared in io-package.json. Consider removing the file or setting "common.blockly": true.',
        );
    }

    if (context.ioPackageJson.common.javascriptRules) {
        if (!context.ioPackageJson.common.javascriptRules.url) {
            context.errors.push(
                '[E5017] JavaScript-Rules support is declared, but no location in property common.javascriptRules.url defined',
            );
        }
        if (!context.filesList.includes(`/admin/${context.ioPackageJson.common.javascriptRules.url}`)) {
            context.errors.push(
                `[E5016] "/admin/${context.ioPackageJson.common.javascriptRules.url}" not found, but JavaScript-Rules support is declared`,
            );
        }
    }

    const forbiddenFiles = ['/iob_npm.done', '/iob', '/iobroker'];

    forbiddenFiles.forEach(file => {
        if (context.filesList.includes(file)) {
            context.errors.push(`[E5003] File "${file}" found in repo! Please remove file.`);
        }
    });

    if (!context.filesList.includes('/package-lock.json')) {
        context.warnings.push(
            '[S5023] "package-lock.json" not found in repo! Please consider to commit it to github repository.',
        );
    }

    if (context['/.travis.yml'] || context.filesList.includes('/.travis.yml')) {
        context.hasTravis = true;
        context.warnings.push(
            '[S5065] ".travis.yml" was found. This file is most likely obsolete and can be removed after verifying that travis is no longer used.',
        );
    }

    if (context['/gulpfile.js']) {
        if (!context.packageJson.devDependencies['gulp']) {
            context.warnings.push(
                '[W5020] "gulpfile.js" found in repo but "gulp" not found at devDependencies at package.json. Check whether it can be removed.',
            );
        } else if (!usesReact) {
            // Check if @iobroker/adapter-dev is present in devDependencies
            if (context.packageJson.devDependencies && context.packageJson.devDependencies['@iobroker/adapter-dev']) {
                context.warnings.push(
                    '[S5031] "gulpfile.js" found in repo while @iobroker/adapter-dev already used. Please check if gulp is still needed.',
                );
            } else {
                context.warnings.push(
                    '[W5013] "gulpfile.js" found in repo! Think about migrating to @iobroker/adapter-dev package',
                );
            }
        }
    } else {
        if (context.packageJson.devDependencies['gulp']) {
            context.warnings.push(
                '[W5021] "gulp" found at devDependencies at package.json but no "gulpfile.js" found. Is this dependency really required?',
            );
        }
    }

    // W5048: Check for obsolete eslint/prettier config files when @iobroker/eslint-config is used
    if (context.packageJson.devDependencies && context.packageJson.devDependencies['@iobroker/eslint-config']) {
        const obsoleteFiles = [
            '/.eslintignore',
            '/.eslintrc.json',
            '/.prettierignore',
            '/.prettierrc.js',
            '/.prettierrc.json',
        ];
        for (const file of obsoleteFiles) {
            if (context.filesList.includes(file)) {
                context.warnings.push(
                    `[W5048] "${file.slice(1)}" is most likely obsolete when using "@iobroker/eslint-config". Please remove it.`,
                );
            }
        }
    }

    if (context.packageJson.devDependencies && context.packageJson.devDependencies['@alcalzone/release-script']) {
        const version = context.packageJson.devDependencies['@alcalzone/release-script'];
        if (compareVersions.compareVersions(version, '3.0.0') >= 0) {
            if (!context['/.releaseconfig.json']) {
                context.warnings.push(
                    '[W5018] "@alcalzone/release-script" (>=3.0.0) is used, but ".releaseconfig.json" not found. Please create.',
                );
            } else {
                common.debug(`context[/.releaseconfig.json: ${context['/.releaseconfig.json']}`);
                try {
                    const releaseConfigJson = JSON.parse(context['/.releaseconfig.json']);
                    common.debug(`releaseConfigJson: ${releaseConfigJson}`);

                    const plugins = releaseConfigJson.plugins || [];
                    common.debug(`plugins: ${plugins}`);

                    // Mapping of plugin names to their package names
                    // Plugins bundled with @alcalzone/release-script (don't need separate installation):
                    // changelog, exec, git, package, version
                    // Plugins requiring separate installation:
                    // iobroker, license, manual-review, lerna
                    const pluginToPackage = {
                        iobroker: '@alcalzone/release-script-plugin-iobroker',
                        license: '@alcalzone/release-script-plugin-license',
                        'manual-review': '@alcalzone/release-script-plugin-manual-review',
                        lerna: '@alcalzone/release-script-plugin-lerna',
                    };

                    // Required plugins for ioBroker adapters
                    const requiredPlugins = ['iobroker', 'license'];
                    // Suggested plugins for ioBroker adapters
                    const suggestedPlugins = ['manual-review'];

                    // Check required plugins are installed as devDependencies
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-iobroker']) {
                        context.errors.push(
                            '[E5024] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-iobroker". Please add.',
                        );
                    }
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-license']) {
                        context.errors.push(
                            '[E5025] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-license". Please add.',
                        );
                    }
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-manual-review']) {
                        context.warnings.push(
                            '[S5026] Consider adding plugin "@alcalzone/release-script-plugin-manual-review".',
                        );
                    }

                    // Check all plugins listed in .releaseconfig.json are installed as devDependencies
                    for (const plugin of plugins) {
                        const packageName = pluginToPackage[plugin];
                        if (packageName && !context.packageJson.devDependencies[packageName]) {
                            context.errors.push(
                                `[E5036] Plugin "${plugin}" is listed at .releaseconfig.json but "${packageName}" is not installed as devDependency. Please add.`,
                            );
                        }
                    }

                    // Check all installed plugin devDependencies are listed in .releaseconfig.json
                    for (const pluginName in pluginToPackage) {
                        const packageName = pluginToPackage[pluginName];
                        if (context.packageJson.devDependencies[packageName]) {
                            if (!plugins.includes(pluginName)) {
                                if (requiredPlugins.includes(pluginName)) {
                                    context.errors.push(
                                        `[E5027] Plugin "${pluginName}" missing at .releaseconfig.json. Please add.`,
                                    );
                                } else if (suggestedPlugins.includes(pluginName)) {
                                    context.warnings.push(
                                        `[W5029] Plugin "${pluginName}" missing at .releaseconfig.json. Please add.`,
                                    );
                                } else {
                                    context.warnings.push(
                                        `[W5037] Plugin "${pluginName}" is installed but not listed at .releaseconfig.json. Please add or remove the devDependency.`,
                                    );
                                }
                            }
                        }
                    }
                } catch (e) {
                    context.errors.push(`[E5030] .releaseconfig.json is no valid json file - ${e}.`);
                }
            }
        }
    }

    if (context.packageJson.main && context.packageJson.main.endsWith('.js')) {
        if (!context[`/${context.packageJson.main}`]) {
            if (!context.ioPackageJson.common.nogit) {
                context.errors.push(
                    `[E5019] "${context.packageJson.main}" found in package.json, but not found as file. Please commit "build/*" tree to github or set "common.noGit" attribute to true at io-package.json.`,
                );
            }
        }
    }

    // Check for outdated lib/tools.js
    if (context.filesList.includes('/lib/tools.js')) {
        // Check if lib/tools.js is used anywhere in the repository
        let isUsed = false;

        // Search through all loaded files for references to tools.js
        for (const fileName of Object.keys(context)) {
            if (fileName.startsWith('/') && typeof context[fileName] === 'string') {
                const content = context[fileName];
                // Look for various patterns that might reference lib/tools.js
                if (
                    content.includes('lib/tools') ||
                    content.includes('./lib/tools') ||
                    content.includes('../lib/tools') ||
                    content.includes('./tools') ||
                    content.includes('../tools')
                ) {
                    isUsed = true;
                    break;
                }
            }
        }

        if (!isUsed) {
            context.warnings.push(
                '[S5032] "lib/tools.js" found in repo but not used anywhere. Consider removing file.',
            );
        }
    }

    // Check for deprecated adapter methods and discouraged setObject usage
    const deprecatedMethods = [
        'createState',
        'createChannel',
        'createDevice',
        'deleteState',
        'deleteChannel',
        'deleteDevice',
        'setObject',
    ];
    const methodWarnings = {
        createState:
            '[W5033] method "createState()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.',
        createChannel:
            '[W5033] method "createChannel()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.',
        createDevice:
            '[W5033] method "createDevice()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.',
        deleteState:
            '[W5033] method "deleteState()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.',
        deleteChannel:
            '[W5033] method "deleteChannel()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.',
        deleteDevice:
            '[W5033] method "deleteDevice()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.',
        setObject:
            '[S5054] method "setObject()" should be avoided. Please use "setObjectNotExists()" or "extendObject()" instead.',
    };
    const letsEncryptWarning =
        '[W5061] "utils.commonTools.letsEncrypt" usage detected. Let\'s Encrypt support was removed in js-controller 6.';

    /**
     * Checks if a line is within an adapter class context by examining the code structure.
     * An adapter class context is one where:
     * 1. The class extends utils.Adapter or similar adapter base classes
     * 2. OR the code uses adapter = utils.Adapter() pattern
     *
     * @param {string[]} lines - All lines of the file
     * @param {number} lineIndex - Current line index being checked
     * @returns {boolean} True if the line is within an adapter class context
     */
    function isInAdapterClassContext(lines, lineIndex) {
        // Look backwards and forwards to understand the context
        // const contextRange = 50; // Look within 50 lines for class context
        const contextRange = 1000; // Look within 1000 lines for class context
        const startIdx = Math.max(0, lineIndex - contextRange);
        const endIdx = Math.min(lines.length - 1, lineIndex + contextRange);

        // Check for class that extends utils.Adapter pattern
        for (let i = startIdx; i < endIdx; i++) {
            const line = lines[i].trim();

            // Pattern 1: class SomeClass extends utils.Adapter
            if (/class\s+\w+\s+extends\s+utils\.Adapter/i.test(line)) {
                // Check if current line is within this class
                if (i < lineIndex) {
                    // Look for the class closing brace to see if we're inside
                    let braceCount = 0;
                    let foundOpenBrace = false;
                    for (let j = i; j <= lineIndex; j++) {
                        const checkLine = lines[j];
                        for (const char of checkLine) {
                            if (char === '{') {
                                braceCount++;
                                foundOpenBrace = true;
                            } else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0 && foundOpenBrace && j < lineIndex) {
                                    // Class ended before our line
                                    break;
                                }
                            }
                        }
                        if (braceCount === 0 && foundOpenBrace && j < lineIndex) {
                            break;
                        }
                    }
                    if (braceCount > 0) {
                        return true; // We're inside the adapter class
                    }
                }
            }

            // Pattern 2: extends Adapter (without utils prefix)
            if (/class\s+\w+\s+extends\s+Adapter/i.test(line) && i < lineIndex) {
                // Similar brace counting logic as above
                let braceCount = 0;
                let foundOpenBrace = false;
                for (let j = i; j <= lineIndex; j++) {
                    const checkLine = lines[j];
                    for (const char of checkLine) {
                        if (char === '{') {
                            braceCount++;
                            foundOpenBrace = true;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0 && foundOpenBrace && j < lineIndex) {
                                break;
                            }
                        }
                    }
                    if (braceCount === 0 && foundOpenBrace && j < lineIndex) {
                        break;
                    }
                }
                if (braceCount > 0) {
                    return true;
                }
            }
        }

        // Check if the method call is actually to a local function by looking for function definitions
        const methodCallMatch = lines[lineIndex].match(/this\.(\w+)\s*\(/);
        if (methodCallMatch) {
            const methodName = methodCallMatch[1];
            // Look for local function definition of this method
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Pattern: this.methodName = function or this.methodName = async function
                if (new RegExp(`this\\.${methodName}\\s*=\\s*(async\\s+)?function`, 'i').test(line)) {
                    return false; // It's a local function, not adapter method
                }
            }
        }

        return false;
    }

    // Track which deprecated methods have already been reported
    const reportedMethods = new Set();
    let reportedLetsEncryptUsage = false;

    // Search through all loaded executable files for deprecated method usage
    for (const fileName of Object.keys(context)) {
        if (fileName.startsWith('/') && typeof context[fileName] === 'string') {
            // Skip files in excluded directories (admin, tests, etc.)
            const pathParts = fileName.split('/').filter(part => part !== '');
            const isInExcludedDir = pathParts.some(part => excludeDirsForExecutables.includes(part));

            if (isInExcludedDir) {
                continue;
            }

            // Only check executable files
            const ext = path.extname(fileName);
            const executableExtensions = ['.js', '.mjs', '.cjs', '.ts'];
            if (!executableExtensions.includes(ext)) {
                continue;
            }

            const content = context[fileName];
            const lines = content.split(/\r\n|\r|\n/g);
            const sanitizedLines = stripStringsAndCommentsPreserveLines(content).split(/\r\n|\r|\n/g);

            for (let i = 0; i < lines.length; i++) {
                const sanitizedLine = sanitizedLines[i];

                if (!reportedLetsEncryptUsage && /\butils\.commonTools\.letsEncrypt\b/.test(sanitizedLine)) {
                    context.warnings.push(letsEncryptWarning);
                    reportedLetsEncryptUsage = true;
                }

                for (const method of deprecatedMethods) {
                    // Skip if this method has already been reported
                    if (reportedMethods.has(method)) {
                        continue;
                    }

                    const searchLine = sanitizedLine;

                    // Check for this.methodName pattern
                    const thisPattern = new RegExp(`\\bthis\\.${method}\\s*\\(`, 'g');
                    // Check for adapter.methodName pattern
                    const adapterPattern = new RegExp(`\\badapter\\.${method}\\s*\\(`, 'g');

                    // Handle this.method() calls - should warn when inside adapter class context
                    if (thisPattern.test(searchLine)) {
                        // Make sure this is not a private function definition
                        const functionDefPattern = new RegExp(
                            `(function\\s+${method}|${method}\\s*[=:]\\s*function|${method}\\s*\\([^)]*\\)\\s*{)`,
                            'i',
                        );
                        if (!functionDefPattern.test(searchLine)) {
                            // Only warn if we're in an adapter class context
                            if (isInAdapterClassContext(lines, i)) {
                                context.warnings.push(methodWarnings[method]);
                                reportedMethods.add(method);
                                break; // Only warn once per line
                            }
                        }
                    }

                    // Handle adapter.method() calls - should warn when called outside of any class
                    if (adapterPattern.test(searchLine)) {
                        // Make sure this is not a private function definition
                        const functionDefPattern = new RegExp(
                            `(function\\s+${method}|${method}\\s*[=:]\\s*function|${method}\\s*\\([^)]*\\)\\s*{)`,
                            'i',
                        );
                        if (!functionDefPattern.test(searchLine)) {
                            // Warn if we're NOT in an adapter class context (outside any class)
                            if (!isInAdapterClassContext(lines, i)) {
                                context.warnings.push(methodWarnings[method]);
                                reportedMethods.add(method);
                                break; // Only warn once per line
                            }
                        }
                    }
                }
            }
        }
    }

    // W5059: Do not use utils.adapter() when adapter uses class mode
    const mainFilePath = context.packageJson.main ? `/${context.packageJson.main}` : '';
    const mainSource =
        typeof context[mainFilePath] === 'string' ? stripStringsAndCommentsPreserveLines(context[mainFilePath]) : '';
    const usesClassMode = /\bclass\s+\w+\s+extends\s+utils\.Adapter\b/i.test(mainSource);

    if (usesClassMode) {
        const utilsAdapterFiles = [];
        const utilsAdapterPattern = /\butils\.adapter\s*\(/i;

        for (const filePath of Object.keys(context)) {
            if (!filePath.startsWith('/') || typeof context[filePath] !== 'string') {
                continue;
            }

            const pathParts = filePath.split('/').filter(part => part !== '');
            const isInExcludedDir = pathParts.some(part => excludeDirsForExecutables.includes(part));
            if (isInExcludedDir) {
                continue;
            }

            const ext = path.extname(filePath);
            const executableExtensions = ['.js', '.mjs', '.cjs', '.ts'];
            if (!executableExtensions.includes(ext)) {
                continue;
            }

            const sourceWithoutComments = stripStringsAndCommentsPreserveLines(context[filePath]);
            if (utilsAdapterPattern.test(sourceWithoutComments)) {
                utilsAdapterFiles.push(filePath.slice(1));
            }
        }

        if (utilsAdapterFiles.length > 0) {
            context.warnings.push(
                `[W5059] Adapter uses class mode ("class ... extends utils.Adapter") in "${context.packageJson.main}" and also uses "utils.adapter(...)" in source file(s): ${utilsAdapterFiles.join(', ')}. Please use only one adapter pattern.`,
            );
        }
    }

    // Packages known to be provided by the js-controller/system and therefore not required as dependencies
    const systemProvidedPackages = new Set(['@iobroker/plugin-sentry']);

    // Extract path alias prefixes from tsconfig.json compilerOptions.paths.
    // These are local path aliases (pseudo-organisations) that should be treated like local files
    // and ignored during dependency checks (e.g. "@backend" from "@backend/*": ["src/*"]).
    const tsConfigPathAliasPrefixes = new Set();
    const tsConfigContent = context['/tsconfig.json'];
    if (tsConfigContent) {
        try {
            const tsConfig = JSON5.parse(String(tsConfigContent));
            const tsPaths = tsConfig?.compilerOptions?.paths;
            if (tsPaths && typeof tsPaths === 'object') {
                for (const key of Object.keys(tsPaths)) {
                    // Extract the first path segment (before the first '/') as the alias prefix.
                    // Also strip any trailing wildcard '*' to handle both "@backend/*" and "@backend*".
                    // E.g. "@backend/*" → "@backend", "@backend*" → "@backend", "someModule" → "someModule"
                    const firstSegment = key.split('/')[0].replace(/\*$/, '');
                    if (firstSegment) {
                        tsConfigPathAliasPrefixes.add(firstSegment);
                    }
                }
            }
        } catch {
            // Ignore parse errors - tsconfig.json validity is checked elsewhere
        }
    }

    // W5042/S5043: Scan source files for require/import statements and check dependencies
    // Exclude files in admin/, build/, doc/, docs/, src-admin/, admin-src/, test/ directories
    // and *.test.* and *.config.* files
    const sourceFileExtensions = new Set(['.js', '.mjs', '.cjs', '.ts']);
    const excludedSourceDirs = new Set([
        'admin',
        'build',
        'doc',
        'docs',
        'template',
        'templates',
        'src-admin',
        'src-editor', // java-script adapter
        'src-rules',
        'src-widgets',
        'www',
        'widgets',
        'admin-src',
        'rules-src',
        'test',
        'node_modules',
        '.git',
        '.vscode',
        '.dev-server',
    ]);
    // Exact file base names to exclude from scanning
    const excludedSourceFiles = new Set(['tasks.js', 'tasks.ts', 'Gruntfile.js', 'gulpfile.js']);

    // Exact relative file paths (without leading slash) to exclude from dependency scanning
    const excludedSourceRelPaths = new Set(['lib/tools.js']);

    const packageDependencies = context.packageJson.dependencies || {};
    const packageDevDependencies = context.packageJson.devDependencies || {};
    const usedPackageDependencies = new Set();
    const implicitRuntimeDependencies = new Set();

    if (context.ioPackageJson.common.plugins && typeof context.ioPackageJson.common.plugins === 'object') {
        for (const pluginName of Object.keys(context.ioPackageJson.common.plugins)) {
            if (pluginName !== 'sentry') {
                implicitRuntimeDependencies.add(`@iobroker/plugin-${pluginName}`);
            }
        }
    }

    // Track packages already reported to avoid duplicate messages
    const reportedDependencyIssues = new Set();

    // Track files containing process.env for E5049/W5049 check
    const processEnvFiles = [];

    // Track files containing process.exit for E5050/W5050 check
    const processExitFiles = [];

    // Track files containing a sleep/wait function implementation for S5051 check
    const sleepFiles = [];

    // Track files with bare setInterval() for S5004 check (not this.setInterval or adapter.setInterval)
    const setIntervalFiles = [];

    // Track files with bare setTimeout() for S5005 check (not this.setTimeout or adapter.setTimeout)
    const setTimeoutFiles = [];
    let hasClearInterval = false;
    let hasClearTimeout = false;

    for (const filePath of Object.keys(context)) {
        if (!filePath.startsWith('/') || typeof context[filePath] !== 'string') {
            continue;
        }

        const ext = path.extname(filePath);
        if (!sourceFileExtensions.has(ext)) {
            continue;
        }

        // Skip files in excluded directories
        const pathParts = filePath.split('/').filter(p => p !== '');
        if (pathParts.some(p => excludedSourceDirs.has(p))) {
            continue;
        }

        // Skip excluded file base names and *.test.* and *.config.* files
        const fileBaseName = path.basename(filePath);
        if (
            excludedSourceFiles.has(fileBaseName) ||
            fileBaseName.includes('.test.') ||
            fileBaseName.includes('.config.')
        ) {
            continue;
        }

        // Skip excluded relative paths
        const relPath = filePath.slice(1); // Remove leading slash
        if (excludedSourceRelPaths.has(relPath)) {
            continue;
        }

        common.debug(`Scanning "${filePath.slice(1)}" for dependencies`);

        // E5049/W5049: Check for process.env usage (after stripping comments to avoid false positives)
        const contentWithoutComments = stripComments(context[filePath]);
        if (/\bprocess\.env\b/.test(contentWithoutComments)) {
            processEnvFiles.push(filePath.slice(1));
        }

        // E5050/W5050: Check for process.exit() calls (after stripping comments to avoid false positives)
        if (/\bprocess\.exit\s*\(/.test(contentWithoutComments)) {
            processExitFiles.push(filePath.slice(1));
        }

        // S5051: Check for custom sleep/wait function implementations (after stripping comments)
        // Matches: function sleep(...), async function sleep(...), const/let/var sleep = ..., and same for 'wait'
        if (/\bfunction\s+(sleep|wait)\s*\(|(?:const|let|var)\s+(sleep|wait)\s*=/.test(contentWithoutComments)) {
            sleepFiles.push(filePath.slice(1));
        }

        // S5004/W5004: Check for bare setInterval() — negative lookbehind excludes this.setInterval / adapter.setInterval
        if (/(?<![.\w])setInterval\s*\(/.test(contentWithoutComments)) {
            const file = filePath.slice(1);
            setIntervalFiles.push(file);
        }
        if (/clearInterval\s*\(/.test(contentWithoutComments)) {
            hasClearInterval = true;
        }

        // S5005/W5005: Check for bare setTimeout() — negative lookbehind excludes this.setTimeout / adapter.setTimeout
        if (/(?<![.\w])setTimeout\s*\(/.test(contentWithoutComments)) {
            const file = filePath.slice(1);
            setTimeoutFiles.push(file);
        }
        if (/clearTimeout\s*\(/.test(contentWithoutComments)) {
            hasClearTimeout = true;
        }

        const imports = extractImports(context[filePath]);

        for (const importTarget of imports) {
            common.debug(`  Found import: "${importTarget}"`);

            // Skip relative paths (./xxx, ../xxx) and absolute paths (/xxx)
            // Skip dynamic generated strings (`${xxx}`) and debug vars
            if (
                importTarget.startsWith('./') ||
                importTarget.startsWith('../') ||
                importTarget.startsWith('/') ||
                importTarget.includes('~') || // '~debug~xx'
                importTarget.includes('$') || // `${myvar}/xxx`
                importTarget.includes('{') ||
                importTarget.includes('}')
            ) {
                continue;
            }

            // Skip obvious filenames
            // NOTE: ical.js is a legal package name.
            // if (
            //     importTarget.endsWith('.js') ||
            //     importTarget.endsWith('.mjs') ||
            //     importTarget.endsWith('.cjs') ||
            //     importTarget.endsWith('.ts')
            // ) {
            //     continue;
            // }

            // Skip node: prefixed built-ins - check is complete
            if (importTarget.startsWith('node:')) {
                continue;
            }

            // Skip path alias pseudo-organisations defined in tsconfig.json compilerOptions.paths.
            // These are local aliases (e.g. "@backend/blabla" when "@backend/*" is defined in paths,
            // or "myAlias" when "myAlias" is defined as an exact alias) and should be treated like
            // local files.
            const importFirstSegment = importTarget.split('/')[0];
            if (tsConfigPathAliasPrefixes.has(importFirstSegment)) {
                continue;
            }

            // Extract base package name (handles scoped packages and subpath imports)
            const packageName = extractPackageName(importTarget);

            // Skip if already reported for this package
            if (reportedDependencyIssues.has(packageName)) {
                continue;
            }

            if (packageDependencies[packageName]) {
                usedPackageDependencies.add(packageName);
                continue;
            }

            // Skip packages known to be provided by the js-controller/system
            if (systemProvidedPackages.has(packageName)) {
                continue;
            }

            // For @types/* packages, devDependencies is also acceptable
            if (packageName.startsWith('@types/') && packageDevDependencies[packageName]) {
                continue;
            }

            // For @iobroker/types, devDependencies is also acceptable
            if (packageName === '@iobroker/types' && packageDevDependencies['@iobroker/types']) {
                continue;
            }

            // @types/iobroker in devDependencies is an acceptable alternative for @iobroker/types
            if (packageName === '@iobroker/types' && packageDevDependencies['@types/iobroker']) {
                continue;
            }

            // Check if it's a known Node.js built-in module
            if (NODE_BUILT_INS.has(packageName)) {
                context.warnings.push(
                    `[S5043] Package "${packageName}" is a built-in Node.js module. Please use "node:${packageName}" instead.`,
                );
            } else {
                context.warnings.push(
                    `[W5042] Package "${packageName}" is used in source file(s) (${filePath.slice(1)}) but not found in dependencies of package.json. Dependency might be missing.`,
                );
            }

            reportedDependencyIssues.add(packageName);
        }
    }

    // E5049/W5049: Report process.env usage based on compact mode setting
    if (processEnvFiles.length > 0) {
        const fileList = processEnvFiles.join(', ');
        const compactValue = context.ioPackageJson.common.compact;
        if (compactValue === false) {
            context.warnings.push(
                `[W5049] process.env is used in source files (${fileList}). Usage of process.env is discouraged in ioBroker adapters.`,
            );
        } else {
            // compact is true or undefined — compact mode is active or may become active
            context.errors.push(
                `[E5049] process.env is used in source files (${fileList}). process.env is incompatible with compact mode. Please use adapter configuration instead.`,
            );
        }
    }

    // E5050/W5050: Report process.exit() usage based on compact mode setting
    if (processExitFiles.length > 0) {
        const fileList = processExitFiles.join(', ');
        const compactValue = context.ioPackageJson.common.compact;
        if (compactValue === false) {
            context.warnings.push(
                `[S5050] process.exit() is called in source files (${fileList}). Calling process.exit() is discouraged in ioBroker adapters. Please avoid it.`,
            );
        } else {
            // compact is true or undefined — compact mode is active or may become active
            context.errors.push(
                `[E5050] process.exit() used in  (${fileList}). This is incompatible with compact mode as it terminates the entire host process. Remove process.exit() or set common.compact to false at io-package.json.`,
            );
        }
    }

    // S5051: Report custom sleep/wait function implementations
    if (sleepFiles.length > 0) {
        const fileList = sleepFiles.join(', ');
        context.warnings.push(
            `[S5051] Custom sleep/wait function(s) found in source files (${fileList}). Consider using the built-in "this.delay()" method provided by the ioBroker adapter base class instead.`,
        );
    }

    // S5004/W5004: Report bare setInterval() usage and missing clearInterval() separately
    if (setIntervalFiles.length > 0) {
        const fileList = setIntervalFiles.join(', ');
        context.warnings.push(
            `[S5004] Plain setInterval() found in source files (${fileList}). Please use this.setInterval() or adapter.setInterval() instead.`,
        );
    }

    if (setIntervalFiles.length > 0 && !hasClearInterval) {
        const fileList = setIntervalFiles.join(', ');
        context.warnings.push(
            `[W5004] setInterval() found in source files (${fileList}) but no clearInterval() detected.`,
        );
    }

    // S5005/W5005: Report bare setTimeout() usage and missing clearTimeout() separately
    if (setTimeoutFiles.length > 0) {
        const fileList = setTimeoutFiles.join(', ');
        context.warnings.push(
            `[S5005] Plain setTimeout() found in source files (${fileList}). Please use this.setTimeout() or adapter.setTimeout() instead.`,
        );
    }

    if (setTimeoutFiles.length > 0 && !hasClearTimeout) {
        const fileList = setTimeoutFiles.join(', ');
        context.warnings.push(
            `[W5005] setTimeout() found in source files (${fileList}) but no clearTimeout() detected.`,
        );
    }

    for (const dependency of Object.keys(packageDependencies)) {
        if (usedPackageDependencies.has(dependency) || implicitRuntimeDependencies.has(dependency)) {
            continue;
        }

        context.warnings.push(
            `[W5060] Package "${dependency}" is listed in dependencies of package.json but not imported or required by any scanned source file. Dependency might be unused.`,
        );
    }

    // 5500 - xxx reserved for jsonConfig module

    // 5600 - 5699: comprehensive i18n checks across the full repository
    M5600__I18n.checkAllI18n(context);

    return context;
}

exports.checkCode = checkCode;
exports.getFilesList = getFilesList;

// List of error and warnings used at this module
// ----------------------------------------------

// [5000] node_modules found in repo. Please delete it
// [5001] Cannot get ${context.branch}.zip on github
// [5002] "admin/img/info-big.png" not found, but selectID.js used in index_m.html
// [5003] File "${file}" found in repo! Please remove file.
// [S5004] Plain setInterval() found in source files (${fileList}). Please use this.setInterval() or adapter.setInterval() instead.
// [W5004] setInterval() found in source files (${fileList}) but no clearInterval() detected.
// [S5005] Plain setTimeout() found in source files (${fileList}). Please use this.setTimeout() or adapter.setTimeout() instead.
// [W5005] setTimeout() found in source files (${fileList}) but no clearTimeout() detected.
// [5006] More non translated in german or russian words found in admin/words.js. You can use https://translator.iobroker.in/ for translations
// [5006] Word "${word}" is not translated to german in admin/words.js. You can use https://translator.iobroker.in/ for translations
// [5006] Word "${word}" is not translated to russian in admin/words.js. You can use https://translator.iobroker.in/ for translations
// [5007] Cannot parse "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}": ${e}
// [5008] "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}" not found, but admin support is declared
// [5009] Cannot parse "admin/i18n/${lang}.json": ${e}
// [5009] Cannot parse "admin/i18n/${lang}/translations.json": ${e}
// [5010] "/admin/i18n/${lang}/translations.json" or "admin/i18n/${lang}.json" not found, but admin support is declared. Please add.
// [5011] Cannot parse "admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}": ${e}
// [5012] "admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}" not found, but custom support is declared
// [5013] "gulpfile.js" found in repo! Think about migrating to @iobroker/adapter-dev package
// [5014] "admin/blockly.js" not found, but blockly support is declared
// [5015] Why did you decide to disable i18n support?
// [5016] "${context.ioPackageJson.common.javascriptRules.url}" not found, but JavaScript-Rules support is declared
// [5017] JavaScript-Rules support is declared, but no location in property common.javascriptRules.url defined
// [5018] "@alcalzone/release-script" (>=3.0.0) is used, but ".releaseconfig.json" not found. Please create.
// [5019] "${context.packageJson.main}" found in package.json, but not found as file
// [5020] "gulpfile.js" found in repo but "gulp" not found at devDependencies at package.json. Check whether it can be removed.
// [5021] "gulp" found at devDependencies at package.json but no "gulpfile.js" found. Is this dependency really required?
// [5022] "Why did you decide not to use i18n support?"
// [5023] "package-lock.json" not found in repo! Please remove from .gitignore!
// [5024] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-iobroker". Please add.
// [5025] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-license". Please add.
// [5026] Consider adding plugin "@alcalzone/release-script-plugin-manual-review".
// [5027] Plugin "${pluginName}" missing at .releaseconfig.json. Please add.
// [5028] -- merged into [5027]
// [5029] Plugin "${pluginName}" missing at .releaseconfig.json. Please add.
// [5030] .releaseconfig.json is no valid json file - ${e}.
// [5036] Plugin "${plugin}" is listed at .releaseconfig.json but "${packageName}" is not installed as devDependency. Please add.
// [5037] Plugin "${pluginName}" is installed but not listed at .releaseconfig.json. Please add or remove the devDependency.
// [5031] "gulpfile.js" found in repo with @iobroker/adapter-dev. Check if gulp is still needed.
// [5032] "lib/tools.js" found in repo but not used anywhere. Consider removing this outdated file.
// [5033] method "${method}()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.
// [5034] Files with conflicting extensions found in directory "${dir}": ${filePaths} - Only one JavaScript/TypeScript file extension (.ts, .js, .cjs, or .mjs) should be used per file name.
// [5035] Cannot parse YAML file "${fileName}": ${e.message}
// [5038] Conflicting JSON files in directory "${dir}": Both ${baseName}.json and ${baseName}.json5 versions of same file exist. Please remove one.
// [5039] "admin/words.js" found but not referenced anywhere. File seems to be outdated, please consider removing it.
// [E5040] Example configuration (option1/option2) found in "native" of io-package.json. Please remove example configuration from your code. (moved from E1111 in M1000)
// [W5041] Example configuration (option1/option2) found in i18n translation files (en, de, ...). Please remove example configuration from your code. (renamed from W1111)
// [W5042] Package "${packageName}" is used in source files but not found in dependencies of package.json. Dependency might be missing.
// [S5043] Package "${packageName}" is a built-in Node.js module. Please use "node:${packageName}" prefix instead.
// [E5044] Cannot parse "/admin/jsonTab.json[5]": ${e}
// [E5045] "/admin/jsonTab.json[5]" not found, but tab support is declared
// [W5046] Using admin/jsonConfig.json(5) requires common.adminUI.config to be set to "json".
// [W5047] "${file}" is most likely outdated since jsonConfig is used. Please consider removing it.
// [W5048] "${file}" is most likely obsolete when using "@iobroker/eslint-config". Please remove it.
// [E5049] process.env is used in source files (${fileList}). process.env is incompatible with compact mode. Please use adapter configuration instead.
// [W5049] process.env is used in source files (${fileList}). Usage of process.env is discouraged in ioBroker adapters.
// [E5050] process.exit() is called in source files (${fileList}). Calling process.exit() is incompatible with compact mode as it terminates the entire host process. Please avoid it.
// [W5050] process.exit() is called in source files (${fileList}). Calling process.exit() is discouraged in ioBroker adapters as it terminates the entire host process. Please avoid it.
// [S5051] Custom sleep/wait function(s) found in source files (${fileList}). Consider using the built-in "this.delay()" method provided by the ioBroker adapter base class instead.
// [W5052] method "setObject()" should be avoided. Please use "setObjectNotExists()" or "extendObject()" instead.
// [W5053] "admin/jsonCustom.json[5]" found but custom support is not declared in io-package.json. Consider removing the file or declaring custom support.
// [W5054] "admin/blockly.js" found but blockly support is not declared in io-package.json. Consider removing the file or setting "common.blockly": true.
// [W5055] "admin/index.html" found but materialize is used. This file is for admin2 (old UI) and is outdated. Please consider removing it.
// [W5056] "admin/custom.html" or "admin/custom_m.html" is no longer supported. Please migrate to "admin/jsonCustom.json".
// [W5057] jsonConfig password field "${nativeKey}" (${locationList}) is not listed at "protectedNative" in io-package.json
// [W5058] jsonConfig password field "${nativeKey}" (${locationList}) is not listed at "encryptedNative" in io-package.json
// [W5059] Adapter uses class mode ("class ... extends utils.Adapter") in "${context.packageJson.main}" and also uses "utils.adapter(...)" in source file(s): ${fileList}. Please use only one adapter pattern.
// [W5060] Package "${dependency}" is listed in dependencies of package.json but not imported or required by any scanned source file. Dependency might be unused.
// [W5061] "utils.commonTools.letsEncrypt" usage detected. Let's Encrypt support was removed in js-controller 6.
// [W5062] jsonConfig uses "encryptedAttributes" in table/accordion (${locationList}). js-controller >= 7.0.7 is required for encrypted object support.
// [W5063] JSON formatting in "${fileName}" is hard to read (${issues}). Please use consistent indentation and proper line breaks.
// [W5054] method "setObject()" should be avoided. Please use "setObjectNotExists()" or "extendObject()" instead.
// [W5515] Schema validation skipped for "${configFile}" due to parse error: ${e.message}
// [W5064] Using admin/jsonTab.json(5) requires common.adminUI.tab to be set to "json".
// [S5065] ".travis.yml" was found. This file is most likely obsolete and can be removed after verifying that travis is no longer used.

// [5500 - ] see M5500_jsonConfig.js

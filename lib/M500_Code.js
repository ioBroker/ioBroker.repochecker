'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Adapter Code
    Numbering   :   500 - 549

*/

const fs = require('node:fs');
const path = require('node:path');

const compareVersions = require('compare-versions');
const JSON5 = require('json5');

const common = require('./common.js');
const M500__jsonConfig = require('./M500__JsonConfig.js');

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
            filesList.push([root, file].join('/').slice(1));
            if (context.readFiles.includes([root, file].join('/').slice(1))) {
                context[[root, file].join('/')] = fs.readFileSync(path.join(dirPath, file), 'utf8');
            }
        }
    });
    return filesList;
}

// E5xx
async function checkCode(context) {
    console.log('\n[E500 - E599] checkCode');

    const readFiles = [
        '/.npmignore',
        '/.gitignore',
        '/iob_npm.done',
        '/.travis.yml',
        '/gulpfile.js',
        '/.releaseconfig.json',

        // Add all potential files anyway. If they exist, they must be valid.
        // If they are unnecessary, a warning could be issued
        '/admin/index_m.html',
        '/admin/words.js',
        '/admin/jsonConfig.json',
        '/admin/jsonConfig.json5',
        '/admin/jsonCustom.json',
        '/admin/jsonCustom.json5',
        '/admin/blockly.js',

        '/src-admin/package.json', // check if react is used
        '/src-widgets/package.json', // check if react is used
        '/src/package.json', // check if react is used
    ];

    context.cfg.allowedLanguages.forEach(lang => readFiles.push(`/admin/i18n/${lang}/translations.json`));

    context.cfg.allowedLanguages.forEach(lang => readFiles.push(`/admin/i18n/${lang}.json`));

    if (context.packageJson.main) {
        readFiles.push(`/${context.packageJson.main}`);
    }

    // Add all executable files to readFiles for proper lib/tools.js usage scanning
    // We need to discover files first to know which ones to read
    let tempFilesList = [];
    if (common.isLocal()) {
        // For local mode, scan the directory to find all files first
        tempFilesList = getAllFiles(process.cwd(), '', []);
    } else {
        // For remote mode, we'll need to get the files list first
        tempFilesList = await common.getFilesList(context);
    }

    // Add all executable files (.js, .mjs, .cjs, .ts) to readFiles, excluding certain directories
    const executableExtensions = ['.js', '.mjs', '.cjs', '.ts'];
    const excludeDirsForExecutables = ['node_modules', 'admin', 'admin-src', '.git', '.vscode', '.dev-server'];

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

    if (common.isLocal()) {
        // check a list of all files in the current path and all subdirectories
        context.readFiles = readFiles;
        context.filesList = [];
        getAllFiles(context, process.cwd(), '', context.filesList);
    } else {
        context.filesList = await common.getFilesList(context);

        for (const fileName of context.filesList) {
            common.debug(`checking file ${fileName}`);

            const found = [];
            if (fileName.match(/^\/node_modules\//) && !found.includes('node_module')) {
                context.errors.push(
                    '[E500] Directory node_modules found in root of repository. Please delete directory.',
                );
                found.push('node_modules');
            }

            if (readFiles.includes(fileName)) {
                common.debug(`    reading ${fileName}`);
                context[fileName] = await common.getFile(context, fileName);
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
        //console.log('"src-admin/package.json" exists');
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
        //console.log('"src-widgets/package.json" exists');
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
        context.warnings.push('[S522] Please consider migrating to admin 5 UI (jsonConfig).');
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
            context.errors.push('[E502] "/admin/img/info-big.png" not found, but selectID.js used in index_m.html ');
        }

        if (context['/admin/words.js']) {
            // at least 3 languages must be in
            const words = extractWords(context['/admin/words.js']);
            if (words) {
                const problem = Object.keys(words).filter(word => !words[word].de || !words[word].ru);
                if (problem.length > 3) {
                    context.errors.push(
                        `[E506] More non translated in german or russian words found in admin/words.js. You can use https://translator.iobroker.in/ for translations`,
                    );
                } else {
                    problem.forEach(word => {
                        if (!words[word].de) {
                            context.errors.push(
                                `[E506] Word "${word}" is not translated to german in admin/words.js. You can use https://translator.iobroker.in/ for translations`,
                            );
                        }
                        if (!words[word].ru) {
                            context.errors.push(
                                `[E506] Word "${word}" is not translated to russian in admin/words.js. You can use https://translator.iobroker.in/ for translations`,
                            );
                        }
                    });
                }
            }
        } else {
            context.checks.push('admin/words.js found.');
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
                    `[E507] Cannot parse "/admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}": ${e}`,
                );
            }
        } else {
            context.errors.push(
                `[E508] "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}" not found, but admin support is declared`,
            );
        }

        if (jsonConfig) {
            if (jsonConfig.i18n === true) {
                context.cfg.allowedLanguages.forEach(lang => {
                    if (context[`/admin/i18n/${lang}/translations.json`]) {
                        try {
                            JSON.parse(context[`/admin/i18n/${lang}/translations.json`]);
                        } catch (e) {
                            context.errors.push(`[E509] Cannot parse "admin/i18n/${lang}/translations.json": ${e}`);
                        }
                    } else if (context[`/admin/i18n/${lang}.json`]) {
                        try {
                            JSON.parse(context[`/admin/i18n/${lang}.json`]);
                        } catch (e) {
                            context.errors.push(`[E509] Cannot parse "admin/i18n/${lang}.json": ${e}`);
                        }
                    } else {
                        context.errors.push(
                            `[E510] "/admin/i18n/${lang}/translations.json" or "admin/i18n/${lang}.json" not found, but admin support is declared. Please add.`,
                        );
                    }
                });
            } else if (jsonConfig.i18n === false) {
                context.warnings.push(`[W515] Why did you decide to disable i18n support?`);
            } else {
                context.warnings.push(`[W522] Why did you decide not to use i18n support?`);
            }

            M500__jsonConfig.checkJsonConfig(
                context,
                `admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}`,
                jsonConfig,
            );
        } // if (jsonConfig) ...
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
                    `[E511] Cannot parse "/admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}": ${e}`,
                );
            }
        } else {
            context.errors.push(
                `[E512] "/admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}" not found, but custom support is declared`,
            );
        }
    }

    if (context.ioPackageJson.common.blockly && !context['/admin/blockly.js']) {
        context.errors.push('[E514] "/admin/blockly.js" not found, but blockly support is declared');
    }

    if (context.ioPackageJson.common.javascriptRules) {
        if (!context.ioPackageJson.common.javascriptRules.url) {
            context.errors.push(
                '[E517] JavaScript-Rules support is declared, but no location in property common.javascriptRules.url defined',
            );
        }
        if (!context.filesList.includes(`/admin/${context.ioPackageJson.common.javascriptRules.url}`)) {
            context.errors.push(
                `[E516] "/admin/${context.ioPackageJson.common.javascriptRules.url}" not found, but JavaScript-Rules support is declared`,
            );
        }
    }

    const forbiddenFiles = ['/iob_npm.done', '/iob', '/iobroker'];

    forbiddenFiles.forEach(file => {
        if (context.filesList.includes(file)) {
            context.errors.push(`[E503] File "${file}" found in repo! Please remove file.`);
        }
    });

    if (!context.filesList.includes('/package-lock.json')) {
        context.warnings.push(
            '[S523] "package-lock.json" not found in repo! Please consider to commit it to github repository.',
        );
    }

    if (context['/.travis.yml']) {
        context.hasTravis = true;
    }

    if (context['/gulpfile.js']) {
        if (!context.packageJson.devDependencies['gulp']) {
            context.warnings.push(
                '[W520] "gulpfile.js" found in repo but "gulp" not found at devDependencies at package.json. Check whether it can be removed.',
            );
        } else if (!usesReact) {
            // Check if @iobroker/adapter-dev is present in devDependencies
            if (context.packageJson.devDependencies && context.packageJson.devDependencies['@iobroker/adapter-dev']) {
                context.warnings.push(
                    '[S531] "gulpfile.js" found in repo while @iobroker/adapter-dev already used. Please check if gulp is still needed.',
                );
            } else {
                context.warnings.push(
                    '[W513] "gulpfile.js" found in repo! Think about migrating to @iobroker/adapter-dev package',
                );
            }
        }
    } else {
        if (context.packageJson.devDependencies['gulp']) {
            context.warnings.push(
                '[W521] "gulp" found at devDependencies at package.json but no "gulpfile.js" found. Is this dependency really required?',
            );
        }
    }

    if (context.packageJson.devDependencies && context.packageJson.devDependencies['@alcalzone/release-script']) {
        const version = context.packageJson.devDependencies['@alcalzone/release-script'];
        if (compareVersions.compareVersions(version, '3.0.0') >= 0) {
            if (!context['/.releaseconfig.json']) {
                context.errors.push(
                    '[E518] "@alcalzone/release-script" (>=3.0.0) is used, but ".releaseconfig.json" not found. Please create.',
                );
            } else {
                common.debug(`context[/.releaseconfig.json: ${context['/.releaseconfig.json']}`);
                try {
                    const releaseConfigJson = JSON.parse(context['/.releaseconfig.json']);
                    common.debug(`releaseConfigJson: ${releaseConfigJson}`);

                    const plugins = releaseConfigJson.plugins;
                    common.debug(`plugins: ${plugins}`);
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-iobroker']) {
                        context.errors.push(
                            '[E524] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-iobroker". Please add.',
                        );
                    } else {
                        if (!plugins.includes('iobroker')) {
                            context.errors.push('[E527] Plugin "iobroker" missing at .releaseconfig.json. Please add.');
                        }
                    }
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-license']) {
                        context.errors.push(
                            '[E525] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-license". Please add.',
                        );
                    } else {
                        if (!plugins.includes('license')) {
                            context.errors.push('[E528] Plugin "license" missing at .releaseconfig.json. Please add.');
                        }
                    }
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-manual-review']) {
                        context.warnings.push(
                            '[S526] Consider adding plugin "@alcalzone/release-script-plugin-manual-review".',
                        );
                    } else {
                        if (!plugins.includes('manual-review')) {
                            context.warnings.push(
                                '[W529] Plugin "manual-review" missing at .releaseconfig.json. Please add.',
                            );
                        }
                    }
                } catch (e) {
                    context.errors.push(`[E530] .releaseconfig.json is no valid json file - ${e}.`);
                }
            }
        }
    }

    if (context.packageJson.main && context.packageJson.main.endsWith('.js')) {
        if (!context[`/${context.packageJson.main}`]) {
            if (!context.ioPackageJson.common.nogit) {
                context.errors.push(
                    `[E519] "${context.packageJson.main}" found in package.json, but not found as file`,
                );
            }
        } else {
            if (
                context[`/${context.packageJson.main}`].includes('setInterval(') &&
                !context[`/${context.packageJson.main}`].includes('clearInterval(')
            ) {
                if (context.ioPackageJson.common.compact) {
                    // if compact mode supported, it is critical
                    context.errors.push(
                        `[E504] setInterval found in "${context.packageJson.main}", but no clearInterval detected`,
                    );
                } else {
                    context.warnings.push(
                        `[W504] setInterval found in "${context.packageJson.main}", but no clearInterval detected`,
                    );
                }
            }
            if (
                context[`/${context.packageJson.main}`].includes('setTimeout(') &&
                !context[`/${context.packageJson.main}`].includes('clearTimeout(')
            ) {
                if (context.ioPackageJson.common.compact) {
                    // if compact mode supported, it is critical
                    // context.errors.push(`[E505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`);
                    context.warnings.push(
                        `[W505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`,
                    );
                } else {
                    context.warnings.push(
                        `[W505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`,
                    );
                }
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
            context.warnings.push('[S532] "lib/tools.js" found in repo but not used anywhere. Consider removing file.');
        }
    }

    // Check for deprecated adapter methods (createState, createChannel, createDevice, deleteState, deleteChannel, deleteDevice)
    const deprecatedMethods = [
        'createState',
        'createChannel',
        'createDevice',
        'deleteState',
        'deleteChannel',
        'deleteDevice',
    ];

    // Track which deprecated methods have already been reported
    const reportedMethods = new Set();

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

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                for (const method of deprecatedMethods) {
                    // Skip if this method has already been reported
                    if (reportedMethods.has(method)) {
                        continue;
                    }

                    // Check for this.methodName or adapter.methodName patterns
                    const patterns = [
                        new RegExp(`\\bthis\\.${method}\\s*\\(`, 'g'),
                        new RegExp(`\\badapter\\.${method}\\s*\\(`, 'g'),
                    ];

                    for (const pattern of patterns) {
                        if (pattern.test(line)) {
                            // Make sure this is not a private function definition
                            const functionDefPattern = new RegExp(
                                `(function\\s+${method}|${method}\\s*[=:]\\s*function|${method}\\s*\\([^)]*\\)\\s*{)`,
                                'i',
                            );
                            if (!functionDefPattern.test(line)) {
                                context.warnings.push(
                                    `[W533] method "${method}()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.`,
                                );
                                reportedMethods.add(method);
                            }
                            break; // Only warn once per line
                        }
                    }
                }
            }
        }
    }

    // first free 0534
    // 550 - xxx reserved for jsonConfig module

    return context;
}

exports.checkCode = checkCode;

// List of error and warnings used at this module
// ----------------------------------------------

// [500] node_modules found in repo. Please delete it
// [501] Cannot get ${context.branch}.zip on github
// [502] "admin/img/info-big.png" not found, but selectID.js used in index_m.html
// [503] File "${file}" found in repo! Please remove file.
// [504] setInterval found in "${context.packageJson.main}", but no clearInterval detected
// [504] setInterval found in "${context.packageJson.main}", but no clearInterval detected
// [505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected
// [505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected
// [505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected
// [506] More non translated in german or russian words found in admin/words.js. You can use https://translator.iobroker.in/ for translations
// [506] Word "${word}" is not translated to german in admin/words.js. You can use https://translator.iobroker.in/ for translations
// [506] Word "${word}" is not translated to russian in admin/words.js. You can use https://translator.iobroker.in/ for translations
// [507] Cannot parse "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}": ${e}
// [508] "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}" not found, but admin support is declared
// [509] Cannot parse "admin/i18n/${lang}.json": ${e}
// [509] Cannot parse "admin/i18n/${lang}/translations.json": ${e}
// [510] "/admin/i18n/${lang}/translations.json" or "admin/i18n/${lang}.json" not found, but admin support is declared. Please add.
// [511] Cannot parse "admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}": ${e}
// [512] "admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}" not found, but custom support is declared
// [513] "gulpfile.js" found in repo! Think about migrating to @iobroker/adapter-dev package
// [514] "admin/blockly.js" not found, but blockly support is declared
// [515] Why did you decide to disable i18n support?
// [516] "${context.ioPackageJson.common.javascriptRules.url}" not found, but JavaScript-Rules support is declared
// [517] JavaScript-Rules support is declared, but no location in property common.javascriptRules.url defined
// [518] "@alcalzone/release-script" (>=3.0.0) is used, but ".releaseconfig.json" not found. Please create.
// [519] "${context.packageJson.main}" found in package.json, but not found as file
// [520] "gulpfile.js" found in repo but "gulp" not found at devDependencies at package.json. Check whether it can be removed.
// [521] "gulp" found at devDependencies at package.json but no "gulpfile.js" found. Is this dependency really required?
// [522] "Why did you decide not to use i18n support?"
// [523] "package-lock.json" not found in repo! Please remove from .gitignore!
// [524] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-iobroker". Please add.
// [525] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-license". Please add.
// [526] Consider adding plugin "@alcalzone/release-script-plugin-manual-review".
// [527] Plugin "iobroker" missing at .releaseconfig.json. Please add.
// [528] Plugin "license" missing at .releaseconfig.json. Please add.
// [529] Plugin "manual-review" missing at .releaseconfig.json. Please add.
// [530] .releaseconfig.json is no valid json file - ${e}.
// [531] "gulpfile.js" found in repo with @iobroker/adapter-dev. Check if gulp is still needed.
// [532] "lib/tools.js" found in repo but not used anywhere. Consider removing this outdated file.
// [533] method "${method}()" is deprecated and will be removed with future js-controller version. Please use "set/deleteObject()" instead.

// [550 - ] see M500_jsonConfig.js

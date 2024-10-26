'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Adapter Code
    Numbering   :   500 - 599

*/

const compareVersions = require('compare-versions');
const JSON5 = require('json5');
const stream = require('node:stream');
const unzipper = require('unzipper');
const util = require('node:util');
const Writable = stream.Writable;


const common = require('./common.js');

const memStore = {};

/* Writable memory stream */
function WMStrm(key, options) {
    // allow use without a new operator
    if (!(this instanceof WMStrm)) {
        return new WMStrm(key, options);
    }
    Writable.call(this, options); // init super
    this.key = key; // save key
    memStore[key] = Buffer.from(''); // empty
}

util.inherits(WMStrm, Writable);

WMStrm.prototype._write = function (chunk, enc, cb) {
    // our memory store stores things in buffers
    const buffer = Buffer.isBuffer(chunk) ?
        chunk :  // already is Buffer use it
        new Buffer(chunk, enc);  // string, convert

    // concat to the buffer already there
    memStore[this.key] = Buffer.concat([memStore[this.key], buffer]);
    cb();
};

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
    } catch (e) {
        return null;
    }
}

// E5xx
async function checkCode(context) {
    console.log('\ncheckCode [E5xx]');

    const readFiles = [
        '.npmignore',
        '.gitignore',
        'iob_npm.done',
        '.travis.yml',
        'gulpfile.js',
        '.releaseconfig.json',

        // Add all potential files anyway. If they exist, they must be valid.
        // If they are unnecessary, a warning could be issued
        'admin/index_m.html',
        'admin/words.js',
        'admin/jsonConfig.json',
        'admin/jsonConfig.json5',
        'admin/jsonCustom.json',
        'admin/jsonCustom.json5',
        'admin/blockly.js',

        'src-admin/package.json',   // check if react is used
        'src-widgets/package.json',   // check if react is used
        'src/package.json',         // check if react is used
    ];

    context.cfg.allowedLanguages.forEach(lang =>
        readFiles.push(`admin/i18n/${lang}/translations.json`)
    );

    context.cfg.allowedLanguages.forEach(lang =>
        readFiles.push(`admin/i18n/${lang}.json`)
    );

    if (context.packageJson.main) {
        readFiles.push(context.packageJson.main);
    }

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
    const data = await common.downloadFile(context.githubUrlOriginal, `/archive/${context.branch}.zip`, true);
    console.log(`${context.branch}.zip ${data.length} bytes`);

    let found = false;
    const bufferStream = new stream.PassThrough();
    bufferStream.end(data);
    context.filesList = [];

    // parse zip file
    const promises = [];
    await (function () { return new Promise(_resolve => {
        common.debug('init bufferstream');
        let root='';
        bufferStream
            .pipe(unzipper.Parse())
            .on('entry', entry => {
                common.debug('on.entry ' + entry.path);
                if (root === '') {
                    root=entry.path;
                    console.log(`Directory root set to ${root}`);
                }
                //if (!found && entry.type === 'Directory' && entry.path.match(/\/node_modules\/$/)) {
                if (!found && entry.type === 'Directory' && entry.path === `${root}node_modules/`) {
                    console.log(`Found ${entry.path}`);
                    found = true;
                    context.errors.push('[E500] Directory node_modules found in root of repository. Please delete directory.');
                }

                // Get a list of all files and `.npmignore` + `.gitignore`
                const name = entry.path.replace(/^[^/]+\//, '');
                context.filesList.push(name);

                if (readFiles.includes(name)) {
                    promises.push(new Promise(resolve => {
                        const wstream = new WMStrm(name);
                        wstream.on('finish', () => {
                            context[`/${name}`] = memStore[name].toString();
                            resolve(context[`/${name}`]);
                        });
                        entry.pipe(wstream);
                    }));
                } else {
                    entry.autodrain();
                }
            })
            .on('error', () => {
                common.debug('on.error');
                context.errors.push(`[E501] Cannot get ${context.branch}.zip on github`);
                return Promise.all(promises).then(() => _resolve(context));
            })
            .on('close', () => {
                common.debug('on.close');
                return Promise.all(promises).then(() => _resolve(context));
            });
    });
    })();

    let usesReact = false;
    if (context.packageJson.devDependencies &&
            (context.packageJson.devDependencies['@iobroker/adapter-react-v5'] || context.packageJson.devDependencies['react'])) {
        console.log('REACT detected at package devDependencies');
        usesReact = true;
    }
    if (context.packageJson.dependencies &&
            (context.packageJson.dependencies['@iobroker/adapter-react-v5'] || context.packageJson.dependencies['react'])) {
        console.log('REACT detected at package dependencies');
        usesReact = true;
    }
    if (context['/src-admin/package.json']) {
        //console.log('"src-admin/package.json" exists');
        const packageJson = JSON.parse(context['/src-admin/package.json']);
        if (packageJson.devDependencies && packageJson.devDependencies['@iobroker/adapter-react-v5'] ) {
            console.log('REACT detected at src-admin/package devDependencies');
            usesReact = true;
        }
        if (packageJson.dependencies && packageJson.dependencies['@iobroker/adapter-react-v5'] ) {
            console.log('REACT detected at src-admin/package dependencies');
            usesReact = true;
        }
    }
    if (context['/src-widgets/package.json']) {
        //console.log('"src-widgets/package.json" exists');
        const packageJson = JSON.parse(context['/src-widgets/package.json']);
        if (packageJson.devDependencies && (
            packageJson.devDependencies['@iobroker/adapter-react-v5'] || packageJson.devDependencies['react'])) {
            console.log('REACT detected at src-widgets/package devDependencies');
            usesReact = true;
        }
        if (packageJson.dependencies && (
            packageJson.dependencies['@iobroker/adapter-react-v5'] || packageJson.dependencies['react'])) {
            console.log('REACT detected at src-widgets/package dependencies');
            usesReact = true;
        }
    }
    if (context['/src/package.json']) {
        //console.log('"src/package.json" exists');
        const packageJson = JSON.parse(context['/src/package.json']);
        if (packageJson.devDependencies && packageJson.devDependencies['@iobroker/adapter-react-v5'] ) {
            // console.log('REACT detected');
            usesReact = true;
        }
        if (packageJson.dependencies && packageJson.dependencies['@iobroker/adapter-react-v5'] ) {
            // console.log('REACT detected');
            usesReact = true;
        }
    }

    if (! usesReact && !context.ioPackageJson.common.noConfig &&
            (!context.ioPackageJson.common.adminUI ||
                (context.ioPackageJson.common.adminUI.config !== 'json' && context.ioPackageJson.common.adminUI.config !== 'none')
            )) {
        context.warnings.push('[S522] Please consider migrating to admin 5 UI (jsonConfig).');
    }

    if (context.ioPackageJson.common.materialize || (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'materialize')) {
        if (context['/admin/index_m.html'] && context['/admin/index_m.html'].includes('selectID.js') && !context.filesList.includes('admin/img/info-big.png')) {
            context.errors.push('[E502] "admin/img/info-big.png" not found, but selectID.js used in index_m.html ');
        }

        if (context['/admin/words.js']) {
            // at least 3 languages must be in
            const words = extractWords(context['/admin/words.js']);
            if (words) {
                const problem = Object.keys(words).filter(word => !words[word].de || !words[word].ru);
                if (problem.length > 3) {
                    context.errors.push(`[E506] More non translated in german or russian words found in admin/words.js. You can use https://translator.iobroker.in/ for translations`);
                } else {
                    problem.forEach(word => {
                        if (!words[word].de) {
                            context.errors.push(`[E506] Word "${word}" is not translated to german in admin/words.js. You can use https://translator.iobroker.in/ for translations`);
                        }
                        if (!words[word].ru) {
                            context.errors.push(`[E506] Word "${word}" is not translated to russian in admin/words.js. You can use https://translator.iobroker.in/ for translations`);
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
                jsonConfig = context['/admin/jsonConfig.json'] ? JSON.parse(context['/admin/jsonConfig.json']) : JSON5.parse(context['/admin/jsonConfig.json5']);
            } catch (e) {
                context.errors.push(`[E507] Cannot parse "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}": ${e}`);
            }
        } else {
            context.errors.push(`[E508] "admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}" not found, but admin support is declared`);
        }

        if (jsonConfig && jsonConfig.i18n === true) {
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
                    context.warnings.push(`[W510] "/admin/i18n/${lang}/translations.json" or "admin/i18n/${lang}.json" not found, but admin support is declared. Please add.`);
                }
            });
        }
        if (jsonConfig && jsonConfig.i18n === false) {
            context.warnings.push(`[W515] Why did you decide to disable i18n support?`);
        }
    }

    if (context.ioPackageJson.common.supportCustoms || context.ioPackageJson.common.jsonCustom || (context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.custom === 'json')) {
        if (context['/admin/jsonCustom.json'] || context['/admin/jsonCustom.json5']) {
            try {
                context['/admin/jsonCustom.json'] ? JSON.parse(context['/admin/jsonCustom.json']) : JSON5.parse(context['/admin/jsonCustom.json5']);
            } catch (e) {
                context.errors.push(`[E511] Cannot parse "admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}": ${e}`);
            }
        } else {
            context.errors.push(`[E512] "admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}" not found, but custom support is declared`);
        }
    }

    if (context.ioPackageJson.common.blockly && !context['/admin/blockly.js']) {
        context.errors.push('[E514] "admin/blockly.js" not found, but blockly support is declared');
    }

    if (context.ioPackageJson.common.javascriptRules) {
        if (!context.ioPackageJson.common.javascriptRules.url) {
            context.errors.push('[E517] JavaScript-Rules support is declared, but no location in property common.javascriptRules.url defined');
        }
        if (!context.filesList.includes('admin/' + context.ioPackageJson.common.javascriptRules.url)) {
            context.errors.push(`[E516] "${context.ioPackageJson.common.javascriptRules.url}" not found, but JavaScript-Rules support is declared`);
        }
    }

    const forbiddenFiles = [
        'iob_npm.done',
        'iob',
        'iobroker'
    ];

    forbiddenFiles.forEach( file => {
        if (context.filesList.includes(file)) {
            context.errors.push(`[E503] File "${file}" found in repo! Please remove file.`);
        }
    });

    if (!context.filesList.includes('package-lock.json')) {
        context.warnings.push('[S523] "package-lock.json" not found in repo! Please consider to commit it to github repository.');
    }

    if (context['/.travis.yml']) {
        context.hasTravis = true;
    }

    if (context['/gulpfile.js']) {
        if (!usesReact) {
            context.warnings.push('[W513] "gulpfile.js" found in repo! Think about migrating to @iobroker/adapter-dev package');
        }
        if (!context.packageJson.devDependencies['gulp']) {
            context.warnings.push('[W520] "gulpfile.js" found in repo but "gulp" not found at devDependencies at package.json. Check whether it can be removed.');
        }
    } else {
        if (context.packageJson.devDependencies['gulp']) {
            context.warnings.push('[W521] "gulp" found at devDependencies at package.json but no "gulpfile.js" found. Is this dependency really required?');
        }
    }

    if (context.packageJson.devDependencies && context.packageJson.devDependencies['@alcalzone/release-script'] ) {
        const version = context.packageJson.devDependencies['@alcalzone/release-script'];
        if ( compareVersions.compareVersions( version, '3.0.0' ) >= 0)  {
            if (!context['/.releaseconfig.json']) {
                context.errors.push('[E518] "@alcalzone/release-script" (>=3.0.0) is used, but ".releaseconfig.json" not found. Please create.');
            } else {
                console.log('context[/.releaseconfig.json: '+ context['/.releaseconfig.json']);
                try {
                    const releaseConfigJson = JSON.parse(context['/.releaseconfig.json']);
                    console.log(`releaseConfigJson: ${releaseConfigJson}`);

                    const plugins = releaseConfigJson.plugins;
                    console.log(`plugins: ${plugins}`);
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-iobroker']) {
                        context.errors.push('[E524] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-iobroker". Please add.');
                    } else {
                        if (!plugins.includes('iobroker')) {
                            context.errors.push('[E527] Plugin "iobroker" missing at .releaseconfig.json. Please add.');
                        }
                    }
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-license']) {
                        context.errors.push('[E525] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-license". Please add.');
                    } else {
                        if (!plugins.includes('license')) {
                            context.errors.push('[E528] Plugin "license" missing at .releaseconfig.json. Please add.');
                        }
                    }
                    if (!context.packageJson.devDependencies['@alcalzone/release-script-plugin-manual-review']) {
                        context.warnings.push('[S526] Consider adding plugin "@alcalzone/release-script-plugin-manual-review".');
                    } else {
                        if (!plugins.includes('manual-review')) {
                            context.warnings.push('[W529] Plugin "manual-review" missing at .releaseconfig.json. Please add.');
                        }
                    }0;
                } catch (e) {
                    context.errors.push(`[E530] .releaseconfig.json is no valid json file - ${e}.`);
                }
            }
        }
    }

    if (context.packageJson.main && context.packageJson.main.endsWith('.js')) {
        if (!context[`/${context.packageJson.main}`]) {
            if (!context.ioPackageJson.common.nogit) {
                context.errors.push(`[E519] "${context.packageJson.main}" found in package.json, but not found as file`);
            }
        } else {
            if (context[`/${context.packageJson.main}`].includes('setInterval(') && !context[`/${context.packageJson.main}`].includes('clearInterval(')) {
                if (context.ioPackageJson.common.compact) {
                    // if compact mode supported, it is critical
                    context.errors.push(`[E504] setInterval found in "${context.packageJson.main}", but no clearInterval detected`);
                } else {
                    context.warnings.push(`[W504] setInterval found in "${context.packageJson.main}", but no clearInterval detected`);
                }
            }
            if (context['/' + context.packageJson.main].includes('setTimeout(') && !context['/' + context.packageJson.main].includes('clearTimeout(')) {
                if (context.ioPackageJson.common.compact) {
                    // if compact mode supported, it is critical
                    // context.errors.push(`[E505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`);
                    context.warnings.push(`[W505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`);
                } else {
                    context.warnings.push(`[W505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`);
                }
            }
        }
    }

    // single free 522
    // first free 0530

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
// [522]
// [523] "package-lock.json" not found in repo! Please remove from .gitignore!
// [524] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-iobroker". Please add.
// [525] "@alcalzone/release-script" requires plugin "@alcalzone/release-script-plugin-license". Please add.
// [526] Consider adding plugin "@alcalzone/release-script-plugin-manual-review".
// [527] Plugin "iobroker" missing at .releaseconfig.json. Please add.
// [528] Plugin "license" missing at .releaseconfig.json. Please add.
// [529] Plugin "manual-review" missing at .releaseconfig.json. Please add.
// [530] .releaseconfig.json is no valid json file - ${e}.


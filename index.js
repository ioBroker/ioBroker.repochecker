#!/usr/bin/env node
/*

   ___      _             _              _____ _               _
  / _ \    | |           | |            /  __ \ |             | |
 / /_\ \ __| | __ _ _ __ | |_ ___ _ __  | /  \/ |__   ___  ___| | _____ _ __
 |  _  |/ _` |/ _` | '_ \| __/ _ \ '__| | |   | '_ \ / _ \/ __| |/ / _ \ '__|
 | | | | (_| | (_| | |_) | ||  __/ |    | \__/\ | | |  __/ (__|   <  __/ |
 \_| |_/\__,_|\__,_| .__/ \__\___|_|     \____/_| |_|\___|\___|_|\_\___|_|
                   | |
                   |_|

 */
const unzipper = require('unzipper');
const util = require('util');
const stream = require('stream');
const Writable = stream.Writable;
const sizeOf = require('image-size');
const axios = require('axios');
const JSON5 = require('json5');
const compareVersions = require('compare-versions');
//const Languagedetect = require('languagedetect');
//const languagedetect = new Languagedetect;

const issues = require('./doc/issues');

const version = require('./package.json').version;

// diable axios caching
axios.defaults.headers = {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
};

// adapt recommended version here
// outdated? // const recommendedAdapterCoreVersion = '3.0.6';
const recommendedJsControllerVersion = '5.0.11';
const recommendedNodeVersion = '18'; // This is the minimum node version which should be required
const requiredNodeVersion = '16';    // This is the minimum node version which must be required

const dependencies = {
    "@iobroker/adapter-core": {
        "required":"3.1.4",
        "recommended":"3.1.6"
    }
};

const devDependencies = {
    "@iobroker/testing": {
        "required":"4.1.3",
        "recommended":"4.1.3"
    }
};

const blacklistPackageJson = {

};

const blacklistIOPackageJson = {
    "installedFrom": {
        "msg": "\"installedFrom\" is invalid at io-package.json. Please remove.",
        "err": true
    },
    "common.installedFrom": {
        "msg": "\"common.installedFrom\" is invalid. Please remove from io-package.json.",
        "err": true
    },
    "common.title": {
        "msg": "\"common.title\" is deprecated and replaced by \"common.titleLang\". Please remove from io-package.json.",
        "err": false
    },
    "common.main": {
        "msg": "\"common.main\" is deprecated and ignored. Please remove from io-package.json. Use \"main\" at package.json instead.",
        "err": false
    },
    "common.materialize": {
        "msg": "\"common.materialize\" is deprecated for admin >= 5 at io-package.json. Please use property \"adminUI\".",
        "err": false
    },
    "common.materializeTab": {
        "msg": "\"common.materializeTab\" is deprecated for admin >= 5 at io-package.json. Please use property \"adminUI\".",
        "err": false
    },
    "common.noConfig": {
        "msg": "\"common.noConfig\" is deprecated for admin >= 5 at io-package.json. Please use property \"adminUI.config\":\"none\".",
        "err": false
    },
    "common.subscribe": {
        "msg": "\"common.subscribe\" will be removed with js-controller >= 6. Please remove from io-package.json and adapt code if required.",
        "err": true
    },
    "common.wapeup": {
        "msg": "\"common.wakeup\" is deprecated and ignored. Please remove from io-package.json.",
        "err": true
    },
};

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

function downloadFile(githubUrl, path, binary, noError) {
    console.log(`Download ${githubUrl}${path || ''}`);
    const options = {};
    if (binary) {
        options.responseType = 'arraybuffer';
    }

    return axios(githubUrl + (path || ''), options)
        .then(response => response.data)
        .catch(e => {
            !noError && console.error(`Cannot download ${githubUrl}${path || ''}`);
            throw e;
        });
}

function getDependencyArray(deps) {
    return deps
        .map(dep => typeof dep === 'object' ? Object.keys(dep) : [dep])
        .reduce((acc, dep) => acc.concat(dep), []);
}

// dependencies might be:
// [ 
//    {"js-controller":">=1.2.3"}
// ]
// or
// [ 
//    {"js-controller":">=1.2.3"},
//    {"vis":">=1.2.3"}
// ]
// or
// [ 
//    {
//      "js-controller":">=1.2.3",
//      "vis":">=1.2.3"
//    }
// ]
// or
// [ 
//    {"js-controller":">=1.2.3"},
//    "vis"
// ]
function getDependencies(deps) {
    const ret = {};
    console.log(`deps: ${JSON.stringify(deps)}, type ${typeof deps}`)
    for (let dep of deps ) {
        if (typeof dep === 'object') {
            for (let key in dep ) {
                ret[key] = dep[key];
            }
        } else {
            ret[ dep ] = '>=0';
        }
    }
    console.log(`ret: ${JSON.stringify(ret)}`)
    return ret;
}

/*
function checkLanguages(langObj) {
    if (Object.keys(langObj).length !== allowedLanguages.length) return false;

    return Object.keys(langObj).filter(lang => allowedLanguages.includes(lang)).length === allowedLanguages.length;
}
*/

function checkLanguages(langObj, languages) {
    return languages.filter( lang => !langObj[lang]);
}

function getGithubApiData(context) {
    return new Promise((resolve, reject) => {
        console.log('\ngetGithubApiData');
        axios.get(context.githubUrlApi, { cache: false })
            .then(response => {
                context.githubApiData = response.data;
                // console.log(`API Data: ${JSON.stringify(context.githubApiData)}`);

                if (!context.branch) {
                    context.branch = context.githubApiData.default_branch; // main vs. master
                    console.log(`Branch was not defined by user - checking branch: ${context.branch}`);
                }

                context.githubUrl = `${context.githubUrlOriginal.replace('https://github.com', 'https://raw.githubusercontent.com')}/${context.branch}`;
                console.log(`Original URL: ${context.githubUrlOriginal}`);
                console.log(`raw:          ${context.githubUrl}`);
                console.log(`api:          ${context.githubUrlApi}`);

                resolve(context);
            })
            .catch(e => {
                context.errors.push(`[E000] FATAL: cannot access repository ${context.githubUrlApi}`);
                reject(e.toJSON())
            });// E0xx
    });
}

// Error ranges
// E0xx
//      check package.json
// 
// E1xx 
//      check io-package.json
// 
// E2xx 
//      check npm and npmjs.org
// 
// E3xx 
//      check testing
// 
// E4xx 
//      check repositories
// 
// E5xx 
//      check code
// 
// E6xx 
//      check README file
// 
// E7xx 
//      check license file
// 
// E8xx 
//      check github repository
//
// E9xx 
//      check .gitignore file

// ---------------------------- let's begin ----------------------------

function getPackageJson(context) {
    return new Promise((resolve, reject) => {
        console.log('\ngetPackageJson');
        
        downloadFile(context.githubUrl, '/package.json')
            .then(packageJson => {
                context.packageJson = packageJson;
                if (typeof context.packageJson === 'string') {
                    try {
                        context.packageJson = JSON.parse(context.packageJson);
                    } catch (e) {
                        context.errors.push(`[E001] Cannot parse package.json: ${e}`);
                    }
                }
                resolve( context );
            })
            .catch(e => reject(e));
    })
};

function getIOPackageJson(context) {
    return new Promise((resolve, reject) => {
        console.log('\ngetIOPackageJson');
        
        downloadFile(context.githubUrl, '/io-package.json')
            .then(ioPackageJson => {
                context.ioPackageJson = ioPackageJson;
                if (typeof context.ioPackageJson === 'string') {
                    try {
                        context.ioPackageJson = JSON.parse(context.ioPackageJson);
                    } catch (e) {
                        context.errors.push(`[E100] Cannot parse ioPackage.json: ${e}`);
                    }
                }
                resolve( context );
            })
            .catch(e => reject(e));
    })
};

        
// check package.json
// E0xx
function checkPackageJson(context) {
    return new Promise((resolve, reject) => {
        console.log('\ncheckPackageJson [E0xx]');
        if (context.packageJson) {
            return resolve(context.packageJson);
        } else {
            throw('package.json not loaded');
        }
    })
    .then(packageJson => {
        context.packageJson = packageJson;
        if (typeof context.packageJson === 'string') {
            try {
                context.packageJson = JSON.parse(context.packageJson);
            } catch (e) {
                context.errors.push(`[E001] Cannot parse package.json: ${e}`);
                return context;
            }
        }

        if (!context.githubUrlOriginal.match(/\/iobroker\./i)) {
            context.errors.push('[E002] No "ioBroker." found in the name of repository');
        } else {
            context.checks.push('"ioBroker" was found in the name of repository');
        }

        if (context.githubUrlOriginal.includes('/iobroker.')) {
            context.errors.push('[E003] Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase');
        } else {
            context.checks.push('Repository has name ioBroker.adaptername (not iobroker.adaptername)');
        }

        const m = context.githubUrlOriginal.match(/\/ioBroker\.(.*)$/);
        let adapterName = '';
        if (!m || !m[1]) {
            context.errors.push(`[E004] No adapter name found in URL: ${context.githubUrlOriginal}`);
        } else {
            context.checks.push('Adapter name found in the URL');
            adapterName = m[1].replace(/\/master$/, '').replace(/\/main$/, '');
        }

        context.adapterName = adapterName;

        if (adapterName.match(/[A-Z]/)) {
            context.errors.push('[E005] Adapter name must be lowercase');
        } else {
            context.checks.push('Adapter name is lowercase');
        }

        if (adapterName.match(/[^-_a-z\d]/)) {
            context.errors.push(`[E006] Invalid characters found in adapter name "${adapterName}". Only lowercase chars, digits, "-" and "_" are allowed`);
        } else {
            context.checks.push(`No invalid characters found in "${adapterName}"`);
        }

        if (adapterName.startsWith('_')) {
            context.errors.push(`[E024] Adapter name "${adapterName}" may not start with '_'`);
        } else {
            context.checks.push(`Adapter name "${adapterName}" does not start with '_'`);
        }

        const n = context.githubUrlOriginal.match(/\/([^/]+)\/iobroker\./i);
        if (!n || !n[1]) {
            context.errors.push('[E007] Cannot find author repo in the URL');
        } else {
            context.authorName = n[1];
        }

        if (context.packageJson.name !== `iobroker.${adapterName.toLowerCase()}`) {
            context.errors.push(`[E020] Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}". Now is "${packageJson.name}"`);
        } else {
            context.checks.push(`Name of adapter in package.json must be lowercase and be equal to "iobroker.${adapterName.toLowerCase()}".`);
        }

        if (!context.packageJson.version) {
            context.errors.push('[E009] No version found in the package.json');
        } else {
            context.checks.push('Version found in package.json');
        }

        if (!context.packageJson.description) {
            context.errors.push('[E010] No description found in the package.json');
        } else {
            context.checks.push('Description found in package.json');
        }

        if (context.packageJson.licenses) {
            context.errors.push('[E021] "licenses" in package.json are deprecated. Please remove and use "license": "NAME" field.');
        } else {
            context.checks.push('No "licenses" found in package.json');
        }

        if (!context.packageJson.author) {
            context.errors.push('[E013] No author found in the package.json');
        } else {
            context.checks.push('Author found in package.json');
        }

        if (context.packageJson._args) {
            context.errors.push('[E014] NPM information found in package.json. Please remove all attributes starting with "_"');
        } else {
            context.checks.push('No npm generated attributes found in package.json');
        }

        if (!context.packageJson.license) {
            context.errors.push('[E015] No license found in package.json');
        } else {
            context.checks.push('"license" found in package.json');

            // check if license valid
            if (!licenses.includes(context.packageJson.license)) {
                context.errors.push('[E016] ${context.packageJson.license} found in package.json is no valid SPDX license. Please use one of listed here: https://spdx.org/licenses/');
            } else {
                context.checks.push('"license" is valid in package.json');
            }
        }

        if (!context.packageJson.repository) {
            context.errors.push('[E017] No repository found in the package.json');
        } else {
            context.checks.push('Repository found in package.json');

            const allowedRepoUrls = [
                context.githubApiData.html_url, // https://github.com/klein0r/ioBroker.luftdaten
                `git+${context.githubApiData.html_url}`, // git+https://github.com/klein0r/ioBroker.luftdaten
                context.githubApiData.git_url, // git://github.com/klein0r/ioBroker.luftdaten.git
                context.githubApiData.ssh_url, // git@github.com:klein0r/ioBroker.luftdaten.git
                context.githubApiData.clone_url, // https://github.com/klein0r/ioBroker.luftdaten.git
                `git+${context.githubApiData.clone_url}` // git+https://github.com/klein0r/ioBroker.luftdaten.git
            ];

            // https://docs.npmjs.com/cli/v7/configuring-npm/package-json#repository
            if (context.packageJson.repository && typeof context.packageJson.repository === 'object') {
                if (context.packageJson.repository.type !== 'git') {
                    context.errors.push(`[E018] Invalid repository type in package.json: ${context.packageJson.repository.type}. It should be git`);
                } else {
                    context.checks.push('Repository type is valid in package.json: git');
                }

                if (!allowedRepoUrls.includes(context.packageJson.repository.url)) {
                    context.errors.push(`[E019] Invalid repository URL in package.json: ${context.packageJson.repository.url}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}`);
                } else {
                    context.checks.push('Repository URL is valid in package.json');
                }
            } else if (context.packageJson.repository && typeof context.packageJson.repository === 'string') {
                if (!allowedRepoUrls.includes(context.packageJson.repository)) {
                    context.errors.push(`[E019] Invalid repository URL in package.json: ${context.packageJson.repository}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}`);
                } else {
                    context.checks.push('Repository URL is valid in package.json');
                }
            } else {
                context.errors.push('[E019] Invalid repository URL in package.json');
            }
        }

        if (reservedAdapterNames.includes(adapterName)) {
            context.errors.push('[E022] Adapter name is reserved. Please rename adapter.');
        } else {
            context.checks.push('Adapter name is not reserved');
        }

        if (!context.ioPackageJson.common.onlyWWW && !context.packageJson.dependencies) {
            context.errors.push('[W030] No dependencies declared at package.json. Is this really correct?');
        }
        if (!context.packageJson.devDependencies) {
            context.errors.push('[E031] No devDependencies declared at package.json. Please correct package.json');
        }

        if ((context.packageJson.dependencies && context.packageJson.dependencies.npm) || (context.packageJson.optionalDependencies && context.packageJson.optionalDependencies.npm)) {
            context.errors.push('[E023] Do not include "npm" as dependency!');
        } else {
            context.checks.push('npm is not in dependencies');
        }

        if ((context.packageJson.dependencies && context.packageJson.dependencies['iobroker.js-controller']) ||
            (context.packageJson.devDependencies && context.packageJson.devDependencies['iobroker.js-controller']) ||
            (context.packageJson.optionalDependencies && context.packageJson.optionalDependencies['iobroker.js-controller'])
        ) {
            context.errors.push('[E025] Do not include "iobroker.js-controller" as dependency!');
        } else {
            context.checks.push('iobroker.js-controller is not in dependencies');
        }

        if (!context.ioPackageJson.common.onlyWWW) {
            if (!context.packageJson.engines) {
                context.errors.push(`[E026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommened`);                                    
            } else {
                if (!context.packageJson.engines.node) {
                    context.errors.push(`[E026] "{'engines': {'node'>='${requiredNodeVersion}'}}" is required at package.json, "{'engines':{'node'>='${recommendedNodeVersion}'}}" is recommened`);                                    
                } else {
                    context.checks.push('engines attribute containing node requirements exist.');
                    // 'engines': { 'node': '>= 18' }
                    // 'engines': { 'node': '>= 18.1.2' }
                    // 'engines': { 'node': '>= 18.1.2 < 19' }
                    const nodeVal = context.packageJson.engines.node;
                    let match = nodeVal.match(/^^(?<cmp>[<>=~]+)?\s*(?<vers>\d+(\.\d+(\.\d+)?)?(\-\w+\.\d+)?)/m);
                    if ( ! match ) {
                        context.warnings.push(`[W027] {'engines' : { 'node' : '${nodeVal}' } }" is not parseable.`);
                    } else {
                        //console.log( `${JSON.stringify(match.groups)}`);
                        if ( match.groups.cmp !== '>' && match.groups.cmp !== '>=' ) {
                            context.warnings.push(`[W028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.`);                                        
                        } else {
                            //console.log( `${match.groups.vers} - ${recommendedNodeVersion}`);
                            if ( ! compareVersions.compare( match.groups.vers, requiredNodeVersion, '>=')) {
                                context.errors.push(`[E029] Node.js ${requiredNodeVersion} is required as minimum, node.js ${recommendedNodeVersion} is recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.`);
                            } else if ( ! compareVersions.compare( match.groups.vers, recommendedNodeVersion, '>=')) {
                                context.warnings.push(`[W028] Minimum node.js version ${recommendedNodeVersion} recommended. Please adapt "{'engines' : { 'node' >= '${match.groups.vers}' } }" at package.json.`);                                        
                            } else {
                                context.checks.push(`Correct node.js version ${match.groups.vers} requested by "engines" attribute at package.json.`);
                            }
                        }
                    }
                }
            }        
        } else {
            context.checks.push('"engines" check skipped for wwwOnly adapter.');
        }

        if (!context.ioPackageJson.common.onlyWWW) {
            for (const dependency in dependencies) {
                const requiredVersion = dependencies[dependency].required;
                const recommendedVersion = dependencies[dependency].recommended;
                let dependencyVersion = context.packageJson.dependencies[`${dependency}`] || '';
                dependencyVersion = dependencyVersion.replace(/[\^\~]/,'' );
                if (!dependencyVersion) {
                    context.errors.push(`[E032] No dependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to dependencies at package.json`);
                } else if (! compareVersions.compare( dependencyVersion, requiredVersion, '>=' )) {
                    context.errors.push(`[E033] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum, ${recommendedVersion} is recommended. Please update dependencies at package.json`);
                } else if (! compareVersions.compare( dependencyVersion, recommendedVersion, '>=' )) {
                    context.warnings.push(`[W034] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating dependencies at package.json`);
                } else {
                    context.checks.push('dependency ${dependency} ${dependencyVersion} is ok');
                }
            }
            context.checks.push('"dependencies" checked.');
        } else {
            context.checks.push('"dependencies" check skipped for wwwOnly adapter.');
        }

        for (const dependency in devDependencies) {
            const requiredVersion = devDependencies[dependency].required;
            const recommendedVersion = devDependencies[dependency].recommended;
            let dependencyVersion = context.packageJson.devDependencies[`${dependency}`] || '';
            dependencyVersion = dependencyVersion.replace(/[\^\~]/,'' );
            if (!dependencyVersion) {
                context.errors.push(`[E035] No devDependency declared for ${dependency}. Please add "${dependency}":"${recommendedVersion}" to devDependencies at package.json`);
            } else if (! compareVersions.compare( dependencyVersion, requiredVersion, '>=' )) {
                context.errors.push(`[E036] ${dependency} ${dependencyVersion} specified. ${requiredVersion} is required as minimum,  ${recommendedVersion} is recommended. Please update devDependencies at package.json`);
            } else if (! compareVersions.compare( dependencyVersion, recommendedVersion, '>=' )) {
                context.warnings.push(`[W037] ${dependency} ${dependencyVersion} specified. ${recommendedVersion} is recommended. Please consider updating devDependencies at package.json`);
            } else {
                context.checks.push('devDependency ${dependency} ${dependencyVersion} is ok');
            }
        }
        context.checks.push('"devDependencies" checked.');

        for (const blacklist in blacklistPackageJson) {
            //console.log(`checking blacklist ${blacklist}`);
            let tmp = context.packageJson;
            let log = '';
            for (const element of blacklist.split('.')){
                log = log + '.' + element;
                //console.log(`   check ${log}`);
                tmp = tmp[element];
                if ( !tmp ){
                    //console.log(`   ${log} does not exist`);
                    break
                }
            }
            if (tmp) {
                if (blacklistPackageJson[blacklist].err) {
                    context.errors.push(`[E038] ${blacklistPackageJson[blacklist].msg}`);
                } else {
                    context.warnings.push(`[W038] ${blacklistPackageJson[blacklist].msg}`);
                }
            } 
            //else {
            //    console.log(`blacklist ${blacklist} no match`);
            //}
        }
        context.checks.push('"blacklist (package)" checked.');

        if (! context.packageJson.keywords) {
            context.errors.push('[E039] "keywords" must be an array within package.json and contain some useful keywords');
        } else if (!Array.isArray(context.packageJson.keywords)) {
            context.errors.push('[E039] "keywords" must be an array within package.json and contain some useful keywords');
        } else {
            const forbiddenKeywords = [];
            const ignoredKeywords = ["iobroker", "smart home", "smarthome", "home automation", "template"];
            const recommendedKeywords = ["ioBroker"];
            //console.log(`[DEBUG] package.keywords: "${context.packageJson.keywords.join(', ')}"`);
            //console.log(`[DEBUG] filtered: "${context.packageJson.keywords.filter(keyword => !ignoredKeywords.includes(keyword.toLowerCase()))}"`);
            if (context.packageJson.keywords.filter(keyword => !ignoredKeywords.includes(keyword.toLowerCase())).length === 0 ) {
                context.errors.push(`[E039] "keywords" within package.json must contain some keywords besides "${context.packageJson.keywords.join(', ')}" related to adapter`);
            }
            if (! recommendedKeywords.filter(keyword => context.packageJson.keywords.includes(keyword)).length > 0) {
                context.warnings.push(`[W040] "keywords" within package.json should contain "${recommendedKeywords.join(', ')}"`);
            }
            if (forbiddenKeywords.filter(keyword => context.packageJson.keywords.map(k => k.toLowerCase()).includes(keyword)).length > 0) {
                context.warnings.push(`[W041] "keywords" within package.json should not contain "${forbiddenKeywords.join(', ')}"`);
            }

            context.checks.push('"keywords" found in package.json and refers to an array');
        }

        if (context.packageJson.globalDependencies) {
            context.errors.push('[E042] "globalDependencies" is misplaced at package.json. Did you mean "common.globalDependencies" at io-package.json?');
        } else {
            context.checks.push('"globalDependencies" not found in package.json');
        }

        // max number is W042

        return context;
    });
}

const allowedLanguages = [
    'en',
    'de',
    'ru',
    'pt',
    'nl',
    'fr',
    'it',
    'es',
    'pl',
    'uk',
    'zh-cn'
];

const requiredLanguages = [
    'en',
    'de',
//    'xx' // TESTING ONLY
];

const allowedModes = {
    'none': 'this adapter will not be started',
    'daemon': 'always running process (will be restarted if process exits)',
    'schedule': 'is started by schedule found in system.adapter…common.schedule - reacts on changes of .schedule by rescheduling with new state',
    'once': 'his adapter will be started every time the system.adapter.. object changed. It will not be restarted after termination.',
    'extension': ''
};

const allowedTypes = {
    'alarm': 'security of home, car, boat, ...',
    'climate-control': 'climate, heaters, air filters, water heaters, ...',
    'communication': 'deliver data for other services via RESTapi, websockets',
    'date-and-time': 'schedules, calendars, ...',
    'energy': 'energy metering',
    'metering': 'other, but energy metering (water, gas, oil, ...)',
    'garden': 'mower, springs, ...',
    'general': 'general purpose adapters, like admin, web, discovery, ...',
    'geoposition': 'geo-positioning. These adapters delivers or accepst the position of other objects or persons.',
    'hardware': 'different multi-purpose hardware, arduino, esp, bluetooth, ...',
    'household': 'vacuum-cleaner, kitchen devices, ...',
    'health': 'Fitness sensors, scales, blood pressure, ...',
    'infrastructure': 'Network, printers, phones, NAS, ...',
    'iot-systems': 'Other comprehensive smarthome systems (software and hardware)',
    'lighting': 'light',
    'logic': 'rules, scripts, parsers, scenes, ...',
    'messaging': 'these adapters send and receive messages from message services: telegram, email, whatsapp, ...',
    'misc-data': 'export/import of some unsorted information, contacts, systeminfo, gazoline prises, share curses, currents (EUR=>USD), ...',
    'multimedia': 'TV, AV Receivers, TV play boxes, Android/apple TV boxes, multi-room music, IR controls, speech input/output, ...',
    'network': 'ping, network detectors, UPnP, ...',
    'protocols': 'Communication protocols: MQTT,',
    'storage': 'logging, data protocols, SQL/NoSQL DBs, file storage, ...',
    'utility': 'different help adapters. Like backup, export/import',
    'vehicle': 'cars',
    'visualization': 'visualisation, like vis, material, mobile',
    'visualization-icons': 'icons for visualisation',
    'visualization-widgets': 'iobroker.vis widgets',
    'weather': 'weather info, air quality, environment statistics'
};

const reservedAdapterNames = [
    'config',
    'system',
    'alias',
    'design',
    'all',
    'enum',
    'this',
    'self',
    '0_userdata',
    '_design',
];

const licenses = [
    '0BSD',
    'AAL',
    'Abstyles',
    'Adobe-2006',
    'Adobe-Glyph',
    'ADSL',
    'AFL-1.1',
    'AFL-1.2',
    'AFL-2.0',
    'AFL-2.1',
    'AFL-3.0',
    'Afmparse',
    'AGPL-1.0-only',
    'AGPL-1.0-or-later',
    'AGPL-3.0-only',
    'AGPL-3.0-or-later',
    'Aladdin',
    'AMDPLPA',
    'AML',
    'AMPAS',
    'ANTLR-PD',
    'Apache-1.0',
    'Apache-1.1',
    'Apache-2.0',
    'APAFML',
    'APL-1.0',
    'APSL-1.0',
    'APSL-1.1',
    'APSL-1.2',
    'APSL-2.0',
    'Artistic-1.0-cl8',
    'Artistic-1.0-Perl',
    'Artistic-1.0',
    'Artistic-2.0',
    'Bahyph',
    'Barr',
    'Beerware',
    'BitTorrent-1.0',
    'BitTorrent-1.1',
    'Borceux',
    'BSD-1-Clause',
    'BSD-2-Clause-FreeBSD',
    'BSD-2-Clause-NetBSD',
    'BSD-2-Clause-Patent',
    'BSD-2-Clause',
    'BSD-3-Clause-Attribution',
    'BSD-3-Clause-Clear',
    'BSD-3-Clause-LBNL',
    'BSD-3-Clause-No-Nuclear-License-2014',
    'BSD-3-Clause-No-Nuclear-License',
    'BSD-3-Clause-No-Nuclear-Warranty',
    'BSD-3-Clause',
    'BSD-4-Clause-UC',
    'BSD-4-Clause',
    'BSD-Protection',
    'BSD-Source-Code',
    'BSL-1.0',
    'bzip2-1.0.5',
    'bzip2-1.0.6',
    'Caldera',
    'CATOSL-1.1',
    'CC-BY-1.0',
    'CC-BY-2.0',
    'CC-BY-2.5',
    'CC-BY-3.0',
    'CC-BY-4.0',
    'CC-BY-NC-1.0',
    'CC-BY-NC-2.0',
    'CC-BY-NC-2.5',
    'CC-BY-NC-3.0',
    'CC-BY-NC-4.0',
    'CC-BY-NC-ND-1.0',
    'CC-BY-NC-ND-2.0',
    'CC-BY-NC-ND-2.5',
    'CC-BY-NC-ND-3.0',
    'CC-BY-NC-ND-4.0',
    'CC-BY-NC-SA-1.0',
    'CC-BY-NC-SA-2.0',
    'CC-BY-NC-SA-2.5',
    'CC-BY-NC-SA-3.0',
    'CC-BY-NC-SA-4.0',
    'CC-BY-ND-1.0',
    'CC-BY-ND-2.0',
    'CC-BY-ND-2.5',
    'CC-BY-ND-3.0',
    'CC-BY-ND-4.0',
    'CC-BY-SA-1.0',
    'CC-BY-SA-2.0',
    'CC-BY-SA-2.5',
    'CC-BY-SA-3.0',
    'CC-BY-SA-4.0',
    'CC0-1.0',
    'CDDL-1.0',
    'CDDL-1.1',
    'CDLA-Permissive-1.0',
    'CDLA-Sharing-1.0',
    'CECILL-1.0',
    'CECILL-1.1',
    'CECILL-2.0',
    'CECILL-2.1',
    'CECILL-B',
    'CECILL-C',
    'ClArtistic',
    'CNRI-Jython',
    'CNRI-Python-GPL-Compatible',
    'CNRI-Python',
    'Condor-1.1',
    'copyleft-next-0.3.0',
    'copyleft-next-0.3.1',
    'CPAL-1.0',
    'CPL-1.0',
    'CPOL-1.02',
    'Crossword',
    'CrystalStacker',
    'CUA-OPL-1.0',
    'Cube',
    'curl',
    'D-FSL-1.0',
    'diffmark',
    'DOC',
    'Dotseqn',
    'DSDP',
    'dvipdfm',
    'ECL-1.0',
    'ECL-2.0',
    'EFL-1.0',
    'EFL-2.0',
    'eGenix',
    'Entessa',
    'EPL-1.0',
    'EPL-2.0',
    'ErlPL-1.1',
    'EUDatagrid',
    'EUPL-1.0',
    'EUPL-1.1',
    'EUPL-1.2',
    'Eurosym',
    'Fair',
    'Frameworx-1.0',
    'FreeImage',
    'FSFAP',
    'FSFUL',
    'FSFULLR',
    'FTL',
    'GFDL-1.1-only',
    'GFDL-1.1-or-later',
    'GFDL-1.2-only',
    'GFDL-1.2-or-later',
    'GFDL-1.3-only',
    'GFDL-1.3-or-later',
    'Giftware',
    'GL2PS',
    'Glide',
    'Glulxe',
    'gnuplot',
    'GPL-1.0-only',
    'GPL-1.0-or-later',
    'GPL-2.0-only',
    'GPL-2.0-or-later',
    'GPL-3.0-only',
    'GPL-3.0-or-later',
    'gSOAP-1.3b',
    'HaskellReport',
    'HPND',
    'IBM-pibs',
    'ICU',
    'IJG',
    'ImageMagick',
    'iMatix',
    'Imlib2',
    'Info-ZIP',
    'Intel-ACPI',
    'Intel',
    'Interbase-1.0',
    'IPA',
    'IPL-1.0',
    'ISC',
    'JasPer-2.0',
    'JSON',
    'LAL-1.2',
    'LAL-1.3',
    'Latex2e',
    'Leptonica',
    'LGPL-2.0-only',
    'LGPL-2.0-or-later',
    'LGPL-2.1-only',
    'LGPL-2.1-or-later',
    'LGPL-3.0-only',
    'LGPL-3.0-or-later',
    'LGPLLR',
    'Libpng',
    'libtiff',
    'LiLiQ-P-1.1',
    'LiLiQ-R-1.1',
    'LiLiQ-Rplus-1.1',
    'Linux-OpenIB',
    'LPL-1.0',
    'LPL-1.02',
    'LPPL-1.0',
    'LPPL-1.1',
    'LPPL-1.2',
    'LPPL-1.3a',
    'LPPL-1.3c',
    'MakeIndex',
    'MirOS',
    'MIT-0',
    'MIT-advertising',
    'MIT-CMU',
    'MIT-enna',
    'MIT-feh',
    'MIT',
    'MITNFA',
    'Motosoto',
    'mpich2',
    'MPL-1.0',
    'MPL-1.1',
    'MPL-2.0-no-copyleft-exception',
    'MPL-2.0',
    'MS-PL',
    'MS-RL',
    'MTLL',
    'Multics',
    'Mup',
    'NASA-1.3',
    'Naumen',
    'NBPL-1.0',
    'NCSA',
    'Net-SNMP',
    'NetCDF',
    'Newsletr',
    'NGPL',
    'NLOD-1.0',
    'NLPL',
    'Nokia',
    'NOSL',
    'Noweb',
    'NPL-1.0',
    'NPL-1.1',
    'NPOSL-3.0',
    'NRL',
    'NTP',
    'OCCT-PL',
    'OCLC-2.0',
    'ODbL-1.0',
    'ODC-By-1.0',
    'OFL-1.0',
    'OFL-1.1',
    'OGL-UK-1.0',
    'OGL-UK-2.0',
    'OGL-UK-3.0',
    'OGTSL',
    'OLDAP-1.1',
    'OLDAP-1.2',
    'OLDAP-1.3',
    'OLDAP-1.4',
    'OLDAP-2.0.1',
    'OLDAP-2.0',
    'OLDAP-2.1',
    'OLDAP-2.2.1',
    'OLDAP-2.2.2',
    'OLDAP-2.2',
    'OLDAP-2.3',
    'OLDAP-2.4',
    'OLDAP-2.5',
    'OLDAP-2.6',
    'OLDAP-2.7',
    'OLDAP-2.8',
    'OML',
    'OpenSSL',
    'OPL-1.0',
    'OSET-PL-2.1',
    'OSL-1.0',
    'OSL-1.1',
    'OSL-2.0',
    'OSL-2.1',
    'OSL-3.0',
    'PDDL-1.0',
    'PHP-3.0',
    'PHP-3.01',
    'Plexus',
    'PostgreSQL',
    'psfrag',
    'psutils',
    'Python-2.0',
    'Qhull',
    'QPL-1.0',
    'Rdisc',
    'RHeCos-1.1',
    'RPL-1.1',
    'RPL-1.5',
    'RPSL-1.0',
    'RSA-MD',
    'RSCPL',
    'Ruby',
    'SAX-PD',
    'Saxpath',
    'SCEA',
    'Sendmail-8.23',
    'Sendmail',
    'SGI-B-1.0',
    'SGI-B-1.1',
    'SGI-B-2.0',
    'SimPL-2.0',
    'SISSL-1.2',
    'SISSL',
    'Sleepycat',
    'SMLNJ',
    'SMPPL',
    'SNIA',
    'Spencer-86',
    'Spencer-94',
    'Spencer-99',
    'SPL-1.0',
    'SugarCRM-1.1.3',
    'SWL',
    'TCL',
    'TCP-wrappers',
    'TMate',
    'TORQUE-1.1',
    'TOSL',
    'TU-Berlin-1.0',
    'TU-Berlin-2.0',
    'Unicode-DFS-2015',
    'Unicode-DFS-2016',
    'Unicode-TOU',
    'Unlicense',
    'UPL-1.0',
    'Vim',
    'VOSTROM',
    'VSL-1.0',
    'W3C-19980720',
    'W3C-20150513',
    'W3C',
    'Watcom-1.0',
    'Wsuipa',
    'WTFPL',
    'X11',
    'Xerox',
    'XFree86-1.1',
    'xinetd',
    'Xnet',
    'xpp',
    'XSkat',
    'YPL-1.0',
    'YPL-1.1',
    'Zed',
    'Zend-2.0',
    'Zimbra-1.3',
    'ZPL-1.1',
    'ZPL-2.0',
    'ZPL-2.1',
];

// E1xx
function checkIOPackageJson(context) {
    context = context || {};
    return new Promise((resolve, reject) => {
        console.log('\ncheckIOPackageJson [E1xx]');
        if (context.ioPackageJson) {
            return resolve(context.ioPackageJson);
        } else {
            throw('io-package.json not loaded');
        }
    })
    .then(ioPackageJson => {
        return new Promise(resolve => {
            context.ioPackageJson = ioPackageJson;
            if (typeof context.ioPackageJson === 'string') {
                try {
                    context.ioPackageJson = JSON.parse(context.ioPackageJson);
                } catch (e) {
                    context.errors.push(`[E100] Cannot parse io-package.json: ${e}`);
                    return resolve(context);
                }
            }

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
                // console.log(`suspecious keys: ${suspiciousKeys.join()}`);

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
                    context.warnings.push('[W171] "common.title" is deprecated in io-package.json. Please remove from io-package.json.');
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
                        let missingLang = checkLanguages(context.ioPackageJson.common.titleLang, requiredLanguages);
                        if (missingLang.length) {
                            context.warnings.push(`[W105] Missing mandatory translation into ${missingLang.join()} of "common.titleLang" in io-package.json.`);
                        }
    
                        missingLang = checkLanguages(context.ioPackageJson.common.titleLang, allowedLanguages);
                        missingLang = missingLang.filter( lang => !requiredLanguages.includes(lang));
                        if (missingLang.length) {
                            missingLang = [... new Set(missingLang)];  // make unique
                            context.warnings.push(`[W105] Missing suggested translation into ${missingLang.join()} of "common.titleLang" in io-package.json.`);
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
                            context.warnings.push(`[W106] "common.titleLang" should not contain word "adapter" in the name. It is clear, that this is adapter. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}`);
                        } else {
                            context.checks.push('"common.titleLang" has no "adapter" in it in io-package.json');
                        }
                    })
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
                        context.errors.push(`[E109] "common.desc" in io-package.json should be an object for many languages. Found only "${context.ioPackageJson.common.desc}"`);
                    } else {
                
                        let missingLang = checkLanguages(context.ioPackageJson.common.desc, requiredLanguages);
                        if (missingLang.length) {
                            context.warnings.push(`[E109] Missing mandatory translation into ${missingLang.join()} of "common.desc" in io-package.json.`);
                        }
    
                        missingLang = checkLanguages(context.ioPackageJson.common.desc, allowedLanguages);
                        missingLang = missingLang.filter( lang => !requiredLanguages.includes(lang));
                        if (missingLang.length) {
                            missingLang = [... new Set(missingLang)];  // make unique
                            context.warnings.push(`[W109] Missing suggested translation into ${missingLang.join()} of "common.desc" in io-package.json.`);
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
                        context.warnings.push(`[W170] "common.keywords" should not contain "${forbiddenKeywords.join(', ')}" io-package.json`);
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

                if (!context.ioPackageJson.common.noConfig) {
                    if (!context.ioPackageJson.common.materialize &&
                        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'json') &&
                        !(context.ioPackageJson.common.adminUI && context.ioPackageJson.common.adminUI.config === 'materialize')
                    ) {
                        context.errors.push('[E114] No adapter are allowed in the repo without admin support (set "common.noConfig = true" and "common.adminUI.config = none" if adapter has no configuration)');
                    } else {
                        context.checks.push('"common.materialize" or "common.adminUI.config" found in io-package.json');
                    }

                    // check moved to W520
                    //if (!context.ioPackageJson.common.adminUI || (context.ioPackageJson.common.adminUI.config !== 'json' && context.ioPackageJson.common.adminUI.config !== 'none')) {
                    //    context.warnings.push('[W156] Adapter should support admin 5 UI (jsonConfig) if you do not use a React based UI');
                    //}
                } else {
                    context.checks.push('adapter has no admin config');

                    if (!context.ioPackageJson.common.adminUI || context.ioPackageJson.common.adminUI.config !== 'none') {
                        context.warnings.push('[W164] Adapters without config "common.noConfig = true" should also set "common.adminUI.config = none"');
                    }
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
                    } else if (!licenses.includes(context.ioPackageJson.common?.licenseInformation?.license)) {
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
                    context.errors.push('[E165] Node mode found in package.json');
                } else {
                    context.checks.push('"common.mode" found in io-package.json');

                    if (!allowedModes[context.ioPackageJson.common.mode]) {
                        context.errors.push(`[E166] "common.mode" ${context.ioPackageJson.common.mode} is unknown in io-package.json.`);
                    } else {
                        context.checks.push('"common.mode" has known mode in io-package.json');

                        if (context.ioPackageJson.common.onlyWWW && context.ioPackageJson.common.mode !== 'none') {
                            context.errors.push('[E162] onlyWWW should have common.mode "none" in io-package.json');
                        }

                        if (context.ioPackageJson.common.mode === 'schedule' && !context.ioPackageJson.common.schedule) {
                            context.errors.push('[E167] schedule adapters must have common.schedule property in io-package.json');
                        }
                    }
                }

                if (!context.ioPackageJson.common.type) {
                    context.errors.push('[E119] No type found in io-package.json');
                } else {
                    context.checks.push('"common.type" found in io-package.json');

                    if (!allowedTypes[context.ioPackageJson.common.type]) {
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
                        context.errors.push('[E130] Too many "common.news" found in io-package.json. Must be less than 20. Please remove old news.');
                    }

                    Object.keys(context.ioPackageJson.common.news).forEach(version => {
                        if (!compareVersions.validateStrict(version)) {
                            context.errors.push(`[E175] Release "${version}" at "common.news" in io-package.json is malformed.`);
                        }
                    });

                    if (!context.ioPackageJson.common.news[context.ioPackageJson.common.version]) {
                        context.errors.push(`[E145] No "common.news" found for actual version ${context.ioPackageJson.common.version} in io-package.json`);
                    }

                    let missingLang =[];
                    Object.keys(context.ioPackageJson.common.news).forEach(version => {               
                        missingLang = missingLang.concat( checkLanguages(context.ioPackageJson.common.news[version], requiredLanguages) );
                    });
                    if (missingLang.length) {
                        missingLang = [... new Set(missingLang)]; // make unique
                        context.warnings.push(`[E145] Missing mandatory translation into ${missingLang.join()} of some "common.news" in io-package.json.`);
                    }

                    missingLang =[];
                    Object.keys(context.ioPackageJson.common.news).forEach(version => {               
                        missingLang = missingLang.concat(checkLanguages(context.ioPackageJson.common.news[version], allowedLanguages));
                    });
                    missingLang = missingLang.filter( lang => !requiredLanguages.includes(lang));
                    if (missingLang.length) {
                        missingLang = [... new Set(missingLang)];  // make unique
                        context.warnings.push(`[W145] Missing suggested translation into ${missingLang.join()} of some "common.news" in io-package.json.`);
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
                    if (!(context.ioPackageJson.common.dependencies instanceof Array)){
                        context.errors.push(`[E185] "common.dependencies" must be an array at io-package.json`);
                    } else {
                        const dependencyArray = getDependencyArray(context.ioPackageJson.common.dependencies);

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
                        }

                    }
                }

                if (context.ioPackageJson.common.globalDependencies) {
                    const dependencyArray = getDependencyArray(context.ioPackageJson.common.globalDependencies);

                    if (!(context.ioPackageJson.common.globalDependencies instanceof Array)){
                        context.errors.push(`[E186] "common.globalDependencies" must be an array at io-package.json`);
                    } else {
                        // js-controller is not allowed in global dependencies (dependencies only)
                        if (dependencyArray.includes('js-controller')) {
                            context.errors.push(`[E161] "js-controller" is not allowed in common.globalDependencies`);
                        }
                    }

                }


                if (context.packageJson.dependencies && context.packageJson.dependencies['@iobroker/adapter-core']) {
                    /*
                        - adapter-core <2.3 has no special dep requirements
                        - adapter-core 2.3.x requires js-controller 1.5.8+ as dep
                        - adapter-core 2.4.0+ required js-controller 2.0.0+ as dep
                    */
                    if (context.packageJson.dependencies['@iobroker/adapter-core'].includes('2.3')) {
                        if (!context.ioPackageJson.common.dependencies) {
                            context.errors.push(`[E153] common.dependencies must contain {"js-controller": ">=1.5.8"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                        } else {
                            if (currentJsControllerVersion) {
                                if (!compareVersions.compare(currentJsControllerVersion, '1.5.8', '>=')) {
                                    context.errors.push(`[E153] common.dependencies must contain {"js-controller": ">=1.5.8"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                                } else {
                                    context.checks.push('adapter-core 2.3 dependency matches js-controller dependency');
                                }
                            } else {
                                context.errors.push(`[E153] common.dependencies must contain {"js-controller": ">=1.5.8"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                            }
                        }
                    } else if (context.packageJson.dependencies['@iobroker/adapter-core'].includes('2.4') || context.packageJson.dependencies['@iobroker/adapter-core'].includes('2.5') || context.packageJson.dependencies['@iobroker/adapter-core'].includes('2.6')) {
                        if (!context.ioPackageJson.common.dependencies) {
                            context.errors.push(`[E154] common.dependencies must contain [{"js-controller": ">=2.0.0"}] or later - recommended: [{"js-controller": ">=${recommendedJsControllerVersion}"}]`);
                        } else {
                            if (currentJsControllerVersion) {
                                if (!compareVersions.compare(currentJsControllerVersion, '2.0.0', '>=')) {
                                    context.errors.push(`[E154] common.dependencies must contain [{"js-controller": ">=2.0.0"}] or later - recommended: [{"js-controller": ">=${recommendedJsControllerVersion}"}]`);
                                } else {
                                    context.checks.push('adapter-core >=2.4 dependency matches js-controller dependency');
                                }
                            } else {
                                context.errors.push(`[E154] common.dependencies must contain {"js-controller": ">=2.0.0"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                            }
                        }
                    }
                }
                
                if (context.ioPackageJson.common.protectedNative) {
                    if (!currentJsControllerVersion) {
                        context.errors.push(`[E157] common.protectedNative requires dependency {"js-controller": ">=2.0.2"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                    } else if (!compareVersions.compare(currentJsControllerVersion, '2.0.2', '>=')) {
                        context.errors.push(`[E157] common.protectedNative requires dependency {"js-controller": ">=2.0.2"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                    }
                }

                if (context.ioPackageJson.common.encryptedNative) {
                    if (!currentJsControllerVersion) {
                        context.errors.push(`[E158] common.encryptedNative requires dependency {"js-controller": ">=3.0.3"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                    } else if (!compareVersions.compare(currentJsControllerVersion, '3.0.3', '>=')) {
                        context.errors.push(`[E158] common.encryptedNative requires dependency {"js-controller": ">=3.0.3"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                    }
                }

                if (context.ioPackageJson.common.notifications) {
                    if (!currentJsControllerVersion) {
                        context.errors.push(`[E168] common.notifications requires dependency {"js-controller": ">=3.2.0"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                    } else if (!compareVersions.compare(currentJsControllerVersion, '3.2.0', '>=')) {
                        context.errors.push(`[E168] common.notifications requires dependency {"js-controller": ">=3.2.0"} or later - recommended: {"js-controller": ">=${recommendedJsControllerVersion}"}`);
                    }
                }

                if (!context.ioPackageJson.common.onlyWWW) {
                    if (!context.ioPackageJson.common.tier) {
                        context.warnings.push(`[W115] \"common.tier\" is required in io-package.json. Please check https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md#adapter.`);
                    } else if (![1, 2, 3].includes(context.ioPackageJson.common.tier)) {
                        context.errors.push(`[E155] Invalid \"common.tier\" value: ${context.ioPackageJson.common.tier} at io-package.json. Only 1, 2 or 3 are allowed!`);
                    } else {
                        context.checks.push('"common.tier" is valid in io-package.json');
                    }
                } else {
                    context.checks.push('"common.tier" check skipped for wwwOnly adapter.');
                }

                if (context.ioPackageJson.common.automaticUpgrade) {
                    context.errors.push(`[E172] "common.automaticUpgrade" will be defined by the user. Please remove from io-package.json`);
                } else {
                    context.checks.push('"common.automaticUpgrade" does not exist in io-package.json');
                }

                //if (context.ioPackageJson.common.wakeup) {
                //    context.warnings.push(`[W174] "common.wakeup" is deprectaed. Please remove from io-package.json`);
                //} else {
                //    context.checks.push('"common.wakeup" does not exist in io-package.json');
                //}

                if (context.ioPackageJson.common.restartAdapters) {
                    const restartAdaptersArray = context.ioPackageJson.common.restartAdapters;

                    // own adapter is not allowed in restart array
                    if (restartAdaptersArray.includes(context.ioPackageJson.common.name)) {
                        context.errors.push(`[E176] Own adapter is not allowed to be listed at "common.restartAdapters" in io-pacakge.json`);
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
                    for (const element of blacklist.split('.')){
                        log = log + '.' + element;
                        //console.log(`   check ${log}`);
                        tmp = tmp[element];
                        if ( !tmp ){
                            //console.log(`   ${log} does not exist`);
                            break
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
                    return downloadFile(context.ioPackageJson.common.extIcon, null, true)
                        .then(icon => {
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

                            context.checks.push('"extIcon" could be downloaded');
                            if (!context.ioPackageJson.common.onlyWWW && context.packageJson.main) {
                                return downloadFile(context.githubUrl, '/' + context.packageJson.main)
                                    .then(() => context.checks.push(context.packageJson.main + ' could be downloaded'))
                                    .catch(() => context.errors.push(`[E124] Main file not found under URL: ${context.githubUrl}/${context.packageJson.main}`))
                                    .then(() => Promise.resolve(context));
                            } else {
                                return Promise.resolve(context);
                            }
                        })
                        .catch(() => context.errors.push(`[E125] External icon not found under URL: ${context.ioPackageJson.common.extIcon}`))
                        .then(() => resolve(context));
                } else {
                    resolve(context);
                }
                // do not put any code behind this line

                // max number is E186
                // free 144
                // duplicates to check 145
            }
        });
    });
}

// E2xx
function checkNpm(context) {
    console.log('\ncheckNpm [E2xx]');
    return axios(`https://registry.npmjs.org/iobroker.${context.adapterName}`)
        .catch(() => ({body: null}))
        .then(async response => {
            let body = response.data;
            // bug in NPM some modules could be accessed via normal web page, but not by API
            if (!body) {
                try {
                    const _response = await axios(`https://www.npmjs.com/package/iobroker.${context.adapterName}`);
                    if (!_response.data) {
                        context.errors.push('[E200] Not found on npm. Please publish');
                        return context;
                    } else {
                        body = _response.data;

                        context.checks.push('Adapter found on npm');
                        if (!body.includes('href="/~bluefox"') && body.includes('href="/~iobluefox"')) {
                            context.errors.push(`[E201] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: "npm owner add bluefox iobroker.${context.adapterName}"`);
                        } else {
                            context.checks.push('Bluefox found in collaborators on NPM');
                        }
                    }
                } catch (error) {
                    context.errors.push('[E200] Not found on npm. Please publish');
                    return context;
                }
            } else {
                context.checks.push('Adapter found on npm');
                if (!body.maintainers ||
                    !body.maintainers.length ||
                    !body.maintainers.find(user => user.name === 'bluefox' || user.name === 'iobluefox')) {
                    context.errors.push(`[E201] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: "npm owner add bluefox iobroker.${context.adapterName}"`);
                } else {
                    context.checks.push('Bluefox found in collaborators on NPM');
                }

                if (!body['dist-tags'] ||
                    context.packageJson.version !== body['dist-tags'].latest
                ) {
                    if ( compareVersions.compare( body['dist-tags'].latest, context.packageJson.version, '>=' )) {
                        context.errors.push(`[E203] Version of package.json (${context.packageJson.version}) lower than latest version on NPM (${
                            (body['dist-tags'] && body['dist-tags'].latest) || JSON.stringify(body)})`);
                    } else {
                        context.warnings.push(`[W202] Version of package.json (${context.packageJson.version}) doesn't match latest version on NPM (${
                            (body['dist-tags'] && body['dist-tags'].latest) || JSON.stringify(body)})`);
                    }
                } else {
                    context.checks.push(`Version of package.json ${context.packageJson.version} matches latest version on NPM`);
                }
            }

            return context;
            // max number is E202
        });
}

// E3xx
function checkTests(context) {
    console.log('\ncheckTests [E3xx]');
    // if found some file in `\.github\workflows` with the test inside => it is OK too
    if (context && context.filesList.find(name => name.startsWith('.github/workflows/') && name.endsWith('.yml') && name.toLowerCase().includes('test'))) {
        context.checks.push('Tests found on github actions');
        return Promise.resolve(context);
    }

    const travisURL = `${context.githubUrlOriginal.replace('github.com', 'api.travis-ci.org')}.png`;

    return axios(travisURL)
        .then(response => {
            if (!response.data) {
                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
                return context;
            }
            if (!response.headers || !response.headers['content-disposition']) {
                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
                return context;
            }
            // inline; filename="passing.png"
            const m = response.headers['content-disposition'].match(/filename="(.+)"$/);
            if (!m) {
                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
                return context;
            }

            if (m[1] === 'unknown.png') {
                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
                return context;
            }

            context.checks.push('Found on travis-ci');

            context.warnings.push('[W302] Use github actions instead of travis-ci');

            if (m[1] !== 'passing.png') {
                context.errors.push('[E301] Tests on Travis-ci.org are broken. Please fix.');
            } else {
                context.checks.push('Tests are OK on travis-ci');
            }

            return context;
            // max number is E302
        });
}

// E4xx
function checkRepo(context) {
    console.log('\ncheckRepo [E4xx]');
    if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.type) {
        // download latest repo
        return axios('https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json')
            .then(async response => {
                let body = response.data;
                if (!body) {
                    context.errors.push('[E400] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json');
                } else {
                    context.latestRepo = body;
                    if (!context.latestRepo[context.adapterName]) {
                        context.warnings.push(`[W400] Cannot find "${context.adapterName}" in latest repository`);

                        if (context.adapterName.includes('_')) {
                            context.errors.push('[E429] Adapter name should use "-" instead of "_"');
                        } else {
                            context.checks.push('Adapter name does not have "_"');
                        }
                    } else {
                        context.checks.push('Adapter found in latest repository');

                        if (context.latestRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                            context.errors.push(`[E402] Types of adapter in latest repository and in io-package.json are different "${context.latestRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"`);
                        } else {
                            context.checks.push(`Types of adapter in latest repository and in io-package.json are equal: "${context.latestRepo[context.adapterName].type}"`);
                        }

                        if (context.latestRepo[context.adapterName].version) {
                            context.errors.push('[E403] Version set in latest repository');
                        } else {
                            context.checks.push('Version not set in latest repository');
                        }

                        const url = `https://raw.githubusercontent.com/${context.authorName}/ioBroker.${context.adapterName}/${context.branch}/`;

                        if (!context.latestRepo[context.adapterName].icon) {
                            context.errors.push('[E404] Icon not found in latest repository');
                        } else {
                            context.checks.push('Icon found in latest repository');

                            if (!context.latestRepo[context.adapterName].icon.startsWith(url)) {
                                context.errors.push(`[E405] Icon (latest) must be in the following path: ${url}`);
                            } else {
                                context.checks.push('Icon found in latest repository');
                            }
                        }
                        if (!context.latestRepo[context.adapterName].meta) {
                            context.errors.push('[E406] Meta URL (latest) not found in latest repository');
                        } else {
                            context.checks.push('Meta URL(latest) found in latest repository');

                            if (context.latestRepo[context.adapterName].meta !== `${url}io-package.json`) {
                                context.errors.push(`[E407] Meta URL (latest) must be equal to ${url}io-package.json`);
                            } else {
                                context.checks.push('Meta URL (latest) is OK in latest repository');
                            }
                        }
                    }
                }

                // download stable repo
                let _response = await axios('https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json');
                body = _response.data;
                if (!body) {
                    context.errors.push('[E420] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json');
                } else {
                    context.stableRepo = body;
                    if (context.stableRepo[context.adapterName]) {
                        if (context.stableRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                            context.errors.push(`[E422] Types of adapter in stable repository and in io-package.json are different "${context.stableRepo[context.adapterName].type}" !== "${context.ioPackageJson.common.type}"`);
                        } else {
                            context.checks.push(`Types of adapter in stable repository and in io-package.json are equal: "${context.stableRepo[context.adapterName].type}"`);
                        }

                        if (!context.latestRepo[context.adapterName]) {
                            context.errors.push('[E423] Adapter was found in stable repository but not in latest repo');
                        } else {
                            context.checks.push('Adapter was found in stable repository and in latest repo');
                        }

                        if (!context.stableRepo[context.adapterName].version) {
                            context.errors.push('[E424] No version set in stable repository');
                        } else {
                            context.checks.push('Version found in stable repository');
                        }

                        const url = `https://raw.githubusercontent.com/${context.authorName}/ioBroker.${context.adapterName}/${context.branch}/`;

                        if (!context.stableRepo[context.adapterName].icon) {
                            context.errors.push('[E425] Icon not found in stable repository');
                        } else {
                            context.checks.push('Icon found in stable repository');

                            if (!context.stableRepo[context.adapterName].icon.startsWith(url)) {
                                context.errors.push(`[E426] Icon (stable) must be in the following path: ${url}`);
                            } else {
                                context.checks.push('Icon (stable) found in latest repository');
                            }
                        }

                        if (!context.stableRepo[context.adapterName].meta) {
                            context.errors.push('[E427] Meta URL (stable) not found in latest repository');
                        } else {
                            context.checks.push('Meta URL (stable) found in latest repository');

                            if (context.stableRepo[context.adapterName].meta !== `${url}io-package.json`) {
                                context.errors.push(`[E428] Meta URL (stable) must be equal to ${url}io-package.json`);
                            } else {
                                context.checks.push('Meta URL (stable) is OK in latest repository');
                            }
                        }
                    }
                }

                _response = await axios('http://repo.iobroker.live/sources-dist-latest.json');
                body = _response.data;
                if (!body) {
                    context.errors.push('[E429] Cannot download http://repo.iobroker.live/sources-dist-latest.json');
                } else {
                    context.latestRepoLive = body;
                }

                _response = await axios('http://repo.iobroker.live/sources-dist.json');
                body = _response.data;
                if (!body) {
                    context.errors.push('[E430] Cannot download http://repo.iobroker.live/sources-dist.json');
                } else {
                    context.stableRepoLive = body;
                }

                if (context.latestRepo && context.latestRepoLive && context.stableRepo && context.stableRepoLive) {
                    if (context.ioPackageJson.common.dependencies) {
                        const dependencies = getDependencies(context.ioPackageJson.common.dependencies);
                        for ( const dependency in dependencies ) {

                            if ( !context.latestRepoLive[dependency] ) {
                                    context.errors.push(`[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`);                            
                            } else {
                                const versDependency = dependencies[dependency];
                                const versRepository = context.latestRepoLive[dependency].version;
//console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                                if (!versDependency.startsWith('>=')) {
                                    context.warnings.push(`[W432] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`);                            
                                } else {
                                    if ( !compareVersions.compare( versRepository, versDependency.replace('>=',''), '>=')) {
                                        context.errors.push(`[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`);
                                    } else {
                                        context.checks.push(`Dependency '${dependency}':'${dependencies[dependency]}' available at latest repository`);
                                    }
                                }
                            }

                            if ( !context.stableRepoLive[dependency] ) {
                                context.warnings.push(`[W433] Dependency ${dependency} not available at stable repository`);                            
                            } else {
                                const versDependency = dependencies[dependency];
                                const versRepository = context.stableRepoLive[dependency].version;
//console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                                if (!versDependency.startsWith('>=')) {
                                    context.warnings.push(`[W434] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`);                            
                                } else {
                                    if ( !compareVersions.compare( versRepository, versDependency.replace('>=',''), '>=')) {
                                        context.errors.push(`[E433] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`);
                                    } else {
                                        context.checks.push(`Dependency '${dependency}':'${dependencies[dependency]}' available at stable repository`);
                                    }
                                }
                            }

                        }
                    } else {
                        context.checks.push('common.dependency check skipped');
                    }

                    if (context.ioPackageJson.common.globalDependencies) {
                        const dependencies = getDependencies(context.ioPackageJson.common.globalDependencies);
                        for ( const dependency in dependencies ) {

                            if ( !context.latestRepoLive[dependency] ) {
                                    context.errors.push(`[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`);                            
                            } else {
                                const versDependency = dependencies[dependency];
                                const versRepository = context.latestRepoLive[dependency].version;
//console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                                if (!versDependency.startsWith('>=')) {
                                    context.warnings.push(`[W432] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`);                            
                                } else {
                                    if ( !compareVersions.compare( versRepository, versDependency.replace('>=',''), '>=')) {
                                        context.errors.push(`[E431] Dependency '${dependency}':'${dependencies[dependency]}' not available at latest repository`);
                                    } else {
                                        context.checks.push(`Dependency '${dependency}':'${dependencies[dependency]}' available at latest repository`);
                                    }
                                }
                            }

                            if ( !context.stableRepoLive[dependency] ) {
                                context.warnings.push(`[W433] Dependency ${dependency} not available at stable repository`);                            
                            } else {
                                const versDependency = dependencies[dependency];
                                const versRepository = context.stableRepoLive[dependency].version;
//console.log( `DEBUG: dependency ${dependency} - ${versDependency} - latest ${versRepository}`);
                                if (!versDependency.startsWith('>=')) {
                                    context.warnings.push(`[W434] Dependency '${dependency}':'${dependencies[dependency]}' should specify '>='`);                            
                                } else {
                                    if ( !compareVersions.compare( versRepository, versDependency.replace('>=',''), '>=')) {
                                        context.errors.push(`[E433] Dependency '${dependency}':'${dependencies[dependency]}' not available at stable repository`);
                                    } else {
                                        context.checks.push(`Dependency '${dependency}':'${dependencies[dependency]}' available at stable repository`);
                                    }
                                }
                            }

                        }
                    } else {
                        context.checks.push('common.globalDependency check skipped');
                    }

                } else {
                    context.checks.push(`Dependency checks skipped due to repository access errors`);                            
                }
                return context;
            });
    } else {
        return Promise.resolve(context);
    }
    // max number is E429
}

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
function checkCode(context) {
    const readFiles = [
        '.npmignore',
        '.gitignore',
        'iob_npm.done',
        '.travis.yml',
        'gulpfile.js',
        '.releaseconfig.json',

        // add all potential files anyway. If they exist they must be valid.
        // if the are not needed a warning could be issued
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
    allowedLanguages.forEach(lang =>
        readFiles.push(`admin/i18n/${lang}/translations.json`));
    allowedLanguages.forEach(lang =>
        readFiles.push(`admin/i18n/${lang}.json`));

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
    return new Promise((resolve, reject) => {
        console.log('\ncheckCode [E5xx]');
        return downloadFile(context.githubUrlOriginal, `/archive/${context.branch}.zip`, true)
            .then(data => {
                console.log(`${context.branch}.zip ${data.length} bytes`);
                let found = false;
                const bufferStream = new stream.PassThrough();
                bufferStream.end(data);
                context.filesList = [];

                const promises = [];

                return new Promise(_resolve => {
                    bufferStream
                        .pipe(unzipper.Parse())
                        .on('entry', entry => {
                            // console.log('Check ' + entry.path);
                            if (!found && entry.type === 'Directory' && entry.path.match(/\/node_modules\/$/)) {
                                console.log(`Found ${entry.path}`);
                                found = true;
                                context.errors.push('[E500] node_modules found in repo. Please delete it');
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
                            context.errors.push(`[E501] Cannot get ${context.branch}.zip on github`);
                            return Promise.all(promises).then(() => _resolve(context));
                        })
                        .on('close', () => {
                            return Promise.all(promises).then(() => _resolve(context));
                        });
                });
            })
            .then(context => {
                let usesReact = false;
                if (context.packageJson.devDependencies && 
                        (context.packageJson.devDependencies['@iobroker/adapter-react-v5'] || context.packageJson.devDependencies['react'])) {
                        console.log('REACT detected at package devDependencies');
                        usesReact = true;
                };
                if (context.packageJson.dependencies && 
                        (context.packageJson.dependencies['@iobroker/adapter-react-v5'] || context.packageJson.dependencies['react'])) {
                    console.log('REACT detected at package dependencies');
                    usesReact = true;
                }
                if (context['/src-admin/package.json']) {
                    //console.log('"src-admin/package.json" exists');
                    let packageJson = JSON.parse(context['/src-admin/package.json']);
                    if (packageJson.devDependencies && packageJson.devDependencies['@iobroker/adapter-react-v5'] ){
                        console.log('REACT detected at src-admin/package devDependencies');
                        usesReact = true;
                    }
                    if (packageJson.dependencies && packageJson.dependencies['@iobroker/adapter-react-v5'] ){
                        console.log('REACT detected at src-admin/package dependencies');
                        usesReact = true;
                    }
                }
                if (context['/src-widgets/package.json']) {
                    //console.log('"src-widgets/package.json" exists');
                    let packageJson = JSON.parse(context['/src-widgets/package.json']);
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
                    let packageJson = JSON.parse(context['/src/package.json']);
                    if (packageJson.devDependencies && packageJson.devDependencies['@iobroker/adapter-react-v5'] ){
                        // console.log('REACT detected');
                        usesReact = true;
                    }
                    if (packageJson.dependencies && packageJson.dependencies['@iobroker/adapter-react-v5'] ){
                        // console.log('REACT detected');
                        usesReact = true;
                    }
                }
                
                if (! usesReact && !context.ioPackageJson.common.noConfig && 
                      (!context.ioPackageJson.common.adminUI || 
                          (context.ioPackageJson.common.adminUI.config !== 'json' && context.ioPackageJson.common.adminUI.config !== 'none')
                      )) {
                    context.warnings.push('[W522] Please consider migrating to admin 5 UI (jsonConfig).');
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
                        allowedLanguages.forEach(lang => {
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
                                context.errors.push(`[E510] "/admin/i18n/${lang}/translations.json" or "admin/i18n/${lang}.json" not found, but admin support is declared`);
                            }
                        });
                    }
                    if (jsonConfig && jsonConfig.i18n === false) {
                        context.warnings.push(`[W515] Why you decided to disable i18n support?`);
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
                        context.errors.push('[E515] JavaScript-Rules support is declared, but no location in property url defined');
                    }
                    if (!context.filesList.includes('admin/' + context.ioPackageJson.common.javascriptRules.url)) {
                        context.errors.push(`[E516] "${context.ioPackageJson.common.javascriptRules.url}" not found, but JavaScript-Rules support is declared`);
                    }
                }

                if (context['/iob_npm.done']) {
                    context.errors.push('[E503] "iob_npm.done" found in repo! Remove that file');
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

                if (context.packageJson.devDependencies && context.packageJson.devDependencies['@alcalzone/release-script'] && !context['/.releaseconfig.json']) {
                    context.errors.push('[E518] "@alcalzone/release-script" is used, but ".releaseconfig.json" not found');
                }

                if (context.packageJson.main && context.packageJson.main.endsWith('.js')) {
                    if (!context['/' + context.packageJson.main]) {
                        if (!context.ioPackageJson.common.nogit) {
                            context.errors.push(`[E519] "${context.packageJson.main}" found in package.json, but not found as file`);
                        }
                    } else {
                        if (context['/' + context.packageJson.main].includes('setInterval(') && !context[`/${context.packageJson.main}`].includes('clearInterval(')) {
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
                                context.errors.push(`[E505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`);
                            } else {
                                context.warnings.push(`[W505] setTimeout found in "${context.packageJson.main}", but no clearTimeout detected`);
                            }
                        }
                    }
                }
                // max E521
                resolve(context);
            })
            .catch(e => reject(e));
    });
}

function getAuthor(author) {
    if (author && typeof author === 'object') {
        return `${author.name} <${author.email}>`;
    } else {
        return author;
    }
}

function checkCommits(context) {
    console.log('checkCommits');
    return downloadFile(context.githubUrlOriginal, `/commits/${context.branch}`)
        .then(data => {
            const m = data.match(/Commits on [\w\s\d]+, (\d\d\d\d)/);
            if (m) {
                context.lastCommitYear = m[1];
            }
            return context;
        });
}

// E6xx
function checkReadme(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/README.md
    return new Promise((resolve, reject) => {
        console.log('\ncheckReadme [E6xx]');
        downloadFile(context.githubUrl, '/README.md')
            .then(data => {
                if (!data) {
                    context.errors.push('[E601] No README.md found');
                } else {
                    context.checks.push('README.md found');

                    if (!data.includes('## Changelog')) {
                        context.errors.push('[E603] NO "## Changelog" found in README.md');
                    } else {
                        context.checks.push('README.md contains Changelog');

                        if (!data.includes(`### ${context.packageJson.version}`)) {
                            context.errors.push(`[E606] Current adapter version ${context.packageJson.version} not found in README.md`);
                        } else {
                            context.checks.push('README.md contains current adapter version');
                        }
                    }

                    const pos = data.indexOf('## License');
                    if (pos === -1) {
                        context.errors.push('[E604] No "## License" found in README.md');
                    } else {
                        context.checks.push('## License found in README.md');
                        const text = data.substring(pos);
                        const year = new Date().getFullYear().toString();
                        if (!text.includes(context.lastCommitYear || year)) {
                            const m = text.match(/(\d\d\d\d)-\d\d\d\d/);
                            if (m) {
                                context.errors.push(`[E605] No actual year found in copyright. Please add "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the end of README.md`);
                            } else {
                                context.errors.push(`[E605] No actual year found in copyright. Please add "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at the end of README.md`);
                            }
                        } else {
                            context.checks.push('Valid copyright year found in README.md');
                        }
                    }

//                    languages = languagedetect.detect(data, 3);
//console.log(JSON.stringify(languages));
                }

                // max E606
                resolve(context);
            })
            .catch(e => reject(e));
    });
}

// E7xx
function checkLicenseFile(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/LICENSE
    return new Promise((resolve, reject) => {
        console.log('\ncheckLicenseFile [E7xx]');
        downloadFile(context.githubUrl, '/LICENSE')
            .then(data => {
                if (!data) {
                    context.errors.push('[E701] NO LICENSE file found');
                } else {
                    context.checks.push('LICENSE file found');

                    if (context.packageJson.license === 'MIT') {
                        const year = new Date().getFullYear().toString();
                        if (!data.includes(context.lastCommitYear || year)) {
                            const m = data.match(/(\d\d\d\d)-\d\d\d\d/);
                            if (m) {
                                context.errors.push(`[E701] No actual year found in LICENSE. Please add "Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE`);
                            } else {
                                context.errors.push(`[E701] No actual year found in LICENSE. Please add "Copyright (c) ${year} ${getAuthor(context.packageJson.author)}" at the start of LICENSE`);
                            }
                        } else {
                            context.checks.push('Valid copyright year found in LICENSE');
                        }
                    }
                }
                resolve(context);
            })
            .catch(e => reject(e));
    });
}

// E80x
function checkGithubRepo(context) {
    return new Promise((resolve) => {
        console.log('\ncheckGithubRepo [E8xx]');

        if (!context.githubApiData.description) {
            context.errors.push(`[E801] No repository about text found. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add the description.`);
        } else {
            context.checks.push('Github repository about found.');
        }

        if (!context.githubApiData.topics || context.githubApiData.topics.length === 0) {
            context.errors.push(`[E802] No topics found in the repository. Please go to "${context.githubUrlOriginal}", press the settings button beside the about title and add some topics.`);
        } else {
            context.checks.push('Github repository about found.');
        }

        if (context.githubApiData.archived) {
            context.errors.push(`[E803] Archived repositories are not allowed.`);
        }

        // max E803 - limited to 849
        resolve(context);
    });
}

function paddingNum(num) {
    if (num >= 10) return num;
    return '0' + num;
}

// E85x
function checkNpmIgnore(context) {
    const checkFiles = [
        'node_modules/',
        'test/',
        'src/',
        'appveyor.yml',
        '.travis.yml',
        'tsconfig.json',
        'tsconfig.build.json',
        'iob_npm.done',
        //         '.git/',
        //         '.github/',
        //         '.idea/',
        //         '.gitignore',
        //         '.npmignore',
        //         '.travis.yml',
        //         '.babelrc',
        //         '.editorconfig',
        //         '.eslintignore',
        //         '.eslintrc.js',
        //         '.fimbullinter.yaml',
        //         '.lgtm.yml',
        //         '.prettierignore',
        //         '.prettierignore',
        //         '.prettierrc.js',
        //         '.vscode/',
    ];

    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/.npmignore
    console.log('\checkNpmIgnore [E85x]');
    if (context.packageJson.files && context.packageJson.files.length) {
        if (context.filesList.includes('.npmignore')) {
            context.warnings.push(`[E851] .npmignore found but "files" is used at package.json. Please remove .npmignore.`);
        } else {
            context.checks.push('package.json "files" already used.');
        }
        return Promise.resolve(context);
    }

    // package.json files section is NOT used
    if (!context.filesList.includes('.npmignore')) {
        context.warnings.push(`[E852] .npmignore not found`);
    } else {
        context.warnings.push(`[W853] .npmignore found - consider using package.json object "files" instead.`);
    
        const rules = (context['/.npmignore'] || '').split('\n').map(line => line.trim().replace('\r', '')).filter(line => line);
        let tooComplexToCheck = false;
        rules.forEach((name, i) => {
            if (name.includes('*')) {
                rules[i] = new RegExp(name
                    .replace('.', '\\.')
                    .replace('/', '\\/')
                    .replace('**', '.*')
                    .replace('*', '[^\\/]*')
                );
            }
            if (name.startsWith('!')) {
                tooComplexToCheck = true;
            }
        });

        // There's no need to put node_modules in `.npmignore`. npm will never publish node_modules in the package, except if one of the modules is explicitly mentioned in bundledDependencies.
        /*if (!rules.includes('node_modules') && !rules.includes('/node_modules') && !rules.includes('/node_modules/*') && !rules.includes('node_modules/*')) {
            !check && context.errors.push(`[E854] node_modules not found in `.npmignore``);
        }*/
        if (!tooComplexToCheck) {
            if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
                !check && context.errors.push(`[E853] iob_npm.done not found in .npmignore`);
            }

            checkFiles.forEach((file, i) => {
                if (context.filesList.includes(file)) {
                    // maybe it is with regex
                    const check = rules.some(rule => {
                        if (typeof rule === 'string') {
                            return rule === file || rule === file.replace(/\/$/, '');
                        } else {
                            return rule.test(file);
                        }
                    });

                    !check && context.errors.push(`[E8${paddingNum(i + 61)}] file ${file} found in repository, but not found in .npmignore`);
                }
            });
        }
    }
    return Promise.resolve(context);
}

// E9xx
function checkGitIgnore(context) {
    const checkFiles = [
        '.idea',
        'tmp',
        'node_modules',
        'iob_npm.done',
    ];

    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/${context.branch}/.gitignore
    console.log('\ncheckGitIgnore [E9xx]');
    if (!context.filesList.includes('.gitignore')) {
        context.warnings.push(`[W901] .gitignore not found`);
    } else {
        const rules = (context['/.gitignore'] || '').split('\n').map(line => line.trim().replace('\r', '')).filter(line => line);
        rules.forEach((name, i) => {
            if (name.includes('*')) {
                rules[i] = new RegExp(name
                    .replace('.', '\\.')
                    .replace('/', '\\/')
                    .replace('**', '.*')
                    .replace('*', '[^\\/]*')
                );
            }
        });

        if (!rules.includes('node_modules') && !rules.includes('/node_modules') && !rules.includes('/node_modules/*') && !rules.includes('node_modules/*')) {
            !check && context.errors.push(`[E902] node_modules not found in .npmignore`);
        }
        if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
            !check && context.errors.push(`[E903] iob_npm.done not found in .gitignore`);
        }

        checkFiles.forEach((file, i) => {
            if (context.filesList.includes(file)) {
                // maybe it is with regex
                const check = rules.some(rule => {
                    if (typeof rule === 'string') {
                        return rule === file || rule === file.replace(/\/$/, '');
                    } else {
                        return rule.test(file);
                    }
                });

                !check && context.errors.push(`[E9${paddingNum(i + 11)}] file ${file} found in repository, but not found in .gitignore`);
            }
        });
    }

    return Promise.resolve(context);
}

function makeResponse(code, data) {
    return {
        statusCode: code || 200,
        headers: {
            'Access-Control-Allow-Origin': '*', // Required for CORS support to work
            'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
        },
        body: typeof data === 'string' ? data : JSON.stringify(data)
    };
}

function check(request, ctx, callback) {
//    console.log('PROCESS: ' + JSON.stringify(request));
    if (!request.queryStringParameters.url) {
        return callback(null, makeResponse(500, {error: 'No github URL provided'}));
    } else {
        const context = {checks: [], errors: [], warnings: []};
        let githubUrl = request.queryStringParameters.url;
        const githubBranch = request.queryStringParameters.branch;

        githubUrl = githubUrl
            .replace('http://', 'https://')
            .replace('https://www.github.com', 'https://github.com')
            .replace('https://raw.githubusercontent.com/', 'https://github.com/');

        if (githubUrl.match(/\/$/)) {
            githubUrl = githubUrl.substring(0, githubUrl.length - 1);
        }

        context.githubUrlOriginal = githubUrl;
        context.githubUrlApi = githubUrl.replace('https://github.com/', 'https://api.github.com/repos/');
        context.branch = githubBranch || null;

        getGithubApiData(context)
            .then(context => getPackageJson(context))
            .then(context => getIOPackageJson(context))
            .then(context => checkPackageJson(context))
            .then(context => checkIOPackageJson(context))
            .then(context => checkNpm(context))
            .then(context => checkCommits(context))
            .then(context => checkRepo(context))
            .then(context => checkCode(context))
            .then(context => checkTests(context))
            .then(context => checkGithubRepo(context))
            .then(context => checkReadme(context))
            .then(context => checkLicenseFile(context))
            .then(context => checkNpmIgnore(context))
            .then(context => checkGitIgnore(context))
            .then(context => {
                return callback(null, makeResponse(200, {
                    result: 'OK',
                    checks: context.checks,
                    errors: context.errors,
                    warnings: context.warnings,
                    version,
                    hasTravis: context.hasTravis
                }));
            })
            .catch(err => {
                console.error(`GLOBAL ERROR: ${err.toString()}, ${JSON.stringify(err)}`);
                context.errors.push(`[E999] GLOBAL ERROR: ${err.toString()}, ${JSON.stringify(err)}`);

                return callback(null, makeResponse(200, {
                    result: 'Errors found',
                    checks: context.checks,
                    errors: context.errors,
                    issues,
                    warnings: context.warnings,
                    version,
                    hasTravis: context.hasTravis,
                    error: `${err.request ? err.request.path : ''} ${err.message}`,
                }));
            });
    }
}

function getText(text, lang) {
    if (typeof text === 'object') {
        if (text[lang]) {
            return text[lang];
        } else {
            return text.en;
        }
    }
    return text;
}

if (typeof module !== 'undefined' && module.parent) {
    exports.handler = check;
} else {
    let repoUrl = 'https://github.com/klein0r/ioBroker.luftdaten';
    let repoBranch = null;

    // Get url from parameters if possible
    if (process.argv.length > 2) {
        repoUrl = process.argv[2];
    }

    // Get branch from parameters if possible
    if (process.argv.length > 3) {
        repoBranch = process.argv[3];
    }

    console.log(`Checking repository ${repoUrl} (branch ${repoBranch})`);
    check({
        queryStringParameters: {
            url: repoUrl,
            branch: repoBranch
        }
    }, null, (err, data) => {
        const context = JSON.parse(data.body);
        console.log(context.result);

        console.log('\n\n########## SUMMARY ##########');
        if (context.errors.length) {
            console.log('\n\nErrors:');
            context.errors.sort().forEach(err => {
                const issue = err.substring(1, 5);
                console.error(err);
                if (issues[issue]) {
                    //if (issues[issue].title) {
                    //    console.error(getText(issues[issue].title, 'en'));
                    //}
                    if (issues[issue].explanation) {
                        console.error(getText(issues[issue].explanation, 'en'));
                    }
                    if (issues[issue].resolving) {
                        console.error(getText(issues[issue].resolving, 'en'));
                    }
                    if (issues[issue].notes) {
                        console.error(getText(issues[issue].notes, 'en'));
                    }
                }

            });
        } else {
            console.log('\n\nNO errors encountered.');
        }
        if (context.warnings.length) {
            console.log('\nWarnings:');
            context.warnings.sort().forEach(err => {
                const issue = err.substring(1, 5);
                console.warn(err);
                if (issues[issue]) {
                    //if (issues[issue].title) {
                    //    console.warn(getText(issues[issue].title, 'en'));
                    //}
                    if (issues[issue].explanation) {
                        console.warn(getText(issues[issue].explanation, 'en'));
                    }
                    if (issues[issue].resolving) {
                        console.warn(getText(issues[issue].resolving, 'en'));
                    }
                    if (issues[issue].notes) {
                        console.warn(getText(issues[issue].notes, 'en'));
                    }
                }

            });
        } else {
            console.log('\n\nNO warnings encountered.');
    }
});
}


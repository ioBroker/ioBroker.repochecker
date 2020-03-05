/* 1.2.7 2020.01.29

   ___      _             _              _____ _               _
  / _ \    | |           | |            /  __ \ |             | |
 / /_\ \ __| | __ _ _ __ | |_ ___ _ __  | /  \/ |__   ___  ___| | _____ _ __
 |  _  |/ _` |/ _` | '_ \| __/ _ \ '__| | |   | '_ \ / _ \/ __| |/ / _ \ '__|
 | | | | (_| | (_| | |_) | ||  __/ |    | \__/\ | | |  __/ (__|   <  __/ |
 \_| |_/\__,_|\__,_| .__/ \__\___|_|     \____/_| |_|\___|\___|_|\_\___|_|
                   | |
                   |_|

 */
let request;
const unzip = require('unzip');
const util = require('util');
const stream = require('stream');
const Writable = stream.Writable;
let https;
const sizeOf = require('image-size');

const memStore = { };

/* Writable memory stream */
function WMStrm(key, options) {
    // allow use without new operator
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

if (typeof require !== 'undefined') {
    try {
        request = require('request');
    } catch (e) {
        request = function (url, options, cb) {
            if (typeof options === 'function') {
                cb = options;
                options = {};
            }
            https = https || require('https');
            https.get(url, resp => {
                let data = '';
                resp.on('data', chunk => data += chunk);
                resp.on('end', () => cb(null, {statusCode: resp.statusCode, headers: resp.headers}, data));
                resp.on('error', () => err => cb(err));
            }).on('error', err => cb(err));
        }
    }
} else {
    request = function (url, cb) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    cb(null, {statusCode: this.status}, this.responseText);
                } else {
                    cb(xhttp.statusText, {statusCode: this.status});
                }
            }
        };
        xhttp.open('GET', url, true);
        xhttp.send();
    }
}

function downloadFile(githubUrl, path, binary) {
    return new Promise((resolve, reject) => {
        console.log('Download ' + githubUrl + (path || ''));
        request(githubUrl + (path || ''), {encoding: binary ? null : 'utf8'}, (err, status, body) => {
            if (!err && status.statusCode === 200) {
                if (binary) {
                    resolve(body);
                } else {
                    resolve(body.toString());
                }
            } else {
                reject(err || status.statusCode);
            }
        });
    });
}

// check package.json
// E0xx
function checkPackageJson(githubUrl, context) {
    context = context || {checks: [], errors: [], warnings: []};

    githubUrl = githubUrl.replace('https://raw.githubusercontent.com/', 'https://github.com/');

    if (githubUrl.match(/\/$/)) {
        githubUrl = githubUrl.substring(0, githubUrl.length - 1);
    }
    context.githubUrlOriginal = githubUrl;
    githubUrl = githubUrl.replace('https://github.com', 'https://raw.githubusercontent.com');
    githubUrl = githubUrl + '/master';
    console.log('Original URL: ' + context.githubUrlOriginal + ', raw: ' + githubUrl);
    context.githubUrl = githubUrl;
    return new Promise((resolve, reject) => {
        if (context.packageJson) {
            return Promise.resolve(context.packageJson);
        } else {
            return downloadFile(githubUrl, '/package.json')
                .then(packageJson => resolve(packageJson))
                .catch(e => reject(e));
        }
    }).then(packageJson => {
        return new Promise(resolve => {
            context.packageJson = packageJson;
            if (typeof context.packageJson === 'string') {
                try {
                    context.packageJson = JSON.parse(context.packageJson);
                } catch (e) {
                    context.errors.push('[E001] Cannot parse packet.json: ' + e);
                    return resolve(context);
                }
            }

            if (!githubUrl.match(/\/iobroker\./i)) {
                context.errors.push('[E002] No "ioBroker." found in the name of repository');
            } else {
                context.checks.push('"ioBroker" was found in the name of repository');
            }

            if (githubUrl.indexOf('/iobroker.') !== -1) {
                context.errors.push('[E003] Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase');
            } else {
                context.checks.push('Repository has name ioBroker.adaptername (not iobroker.adaptername)');
            }

            const m = githubUrl.match(/\/ioBroker\.(.*)$/);
            let adapterName = '';
            if (!m || !m[1]) {
                context.errors.push('[E004] No adapter name found in URL: ' + githubUrl);
            } else {
                context.checks.push('Adapter name found in the URL');
                adapterName = m[1].replace(/\/master$/, '');
            }

            context.adapterName = adapterName;

            if (adapterName.match(/[A-Z]/)) {
                context.errors.push('[E005] Adapter name must be lowercase');
            } else {
                context.checks.push('Adapter name is lowercase');
            }

            if (adapterName.match(/[^-_a-z0-9]/)) {
                context.errors.push('[E006] Invalid characters found in adapter name "' + adapterName + '". Only lowercase chars, "-" and "_" are allowed');
            } else {
                context.checks.push('No invalid characters found in "' + adapterName + '"');
            }

            const n = githubUrl.match(/\/([^\/]+)\/iobroker\./i);
            if (!n || !n[1]) {
                context.errors.push('[E007] Cannot find author repo in the URL');
            } else {
                context.authorName = n[1];
            }

            if (context.packageJson.name !== 'iobroker.' + adapterName.toLowerCase()) {
                context.errors.push('[E020] Name of adapter in package.json must be lowercase and be equal to "iobroker.' + adapterName.toLowerCase() + '". Now is "' + packageJson.name + '"');
            } else {
                context.checks.push('Name of adapter in package.json must be lowercase and be equal to "iobroker.' + adapterName.toLowerCase() + '".');
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

            if (!context.packageJson.license) {
                context.errors.push('[E011] No license found in the package.json');
            } else {
                context.checks.push('License found in package.json');
            }

            if (context.packageJson.licenses) {
                context.errors.push('[E021] "licenses" in package.json are depricated. Please use only "license": "NAME" field.');
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
                if (licenses.indexOf(context.packageJson.license) === -1) {
                    context.errors.push('[E016] No SPDX license found in package.json. Please use one of listed here: https://spdx.org/licenses/');
                } else {
                    context.checks.push('"license" is valid in package.json');
                }
            }

            if (!context.packageJson.repository) {
                context.errors.push('[E017] No repository found in the package.json');
            } else {
                context.checks.push('Repository found in package.json');

                if (context.packageJson.repository.type !== 'git') {
                    context.errors.push('[E018] Invalid repository type: ' + context.packageJson.repository.type + '. It should be git');
                } else {
                    context.checks.push('Repository type is valid: git');
                }

                if (context.packageJson.repository.url.indexOf(context.githubUrlOriginal) === -1) {
                    context.errors.push('[E019] Invalid repository URL: ' + context.packageJson.repository.url + '. Expected: git+' + context.githubUrlOriginal + '.git');
                } else {
                    context.checks.push('Repository URL is valid in package.json');
                }
            }
            if (reservedAdapterNames.indexOf(adapterName) !== -1) {
                context.errors.push('[E022] Adapter name is reserved!');
            } else {
                context.checks.push('Adapter name is not reserved');
            }

            // max number is E022

            resolve(context);
        });
    });
}

const allowedTypes = {
    "alarm": "security of home, car, boat, ...",
    "climate-control": "climate, heaters, air filters, water heaters, ...",
    "communication": "deliver data for other services via RESTapi, websockets",
    "date-and-time": "schedules, calendars, ...",
    "energy": "energy metering",
    "metering": "other, but energy metering (water, gas, oil, ...)",
    "garden": "mower, springs, ...",
    "general": "general purpose adapters, like admin, web, discovery, ...",
    "geoposition": "geo-positioning. These adapters delivers or accepst the position of other objects or persons.",
    "hardware": "different multi-purpose hardware, arduino, esp, bluetooth, ...",
    "household": "vacuum-cleaner, kitchen devices, ...",
    "health": "Fitness sensors, scales, blood pressure, ...",
    "infrastructure": "Network, printers, phones, NAS, ...",
    "iot-systems": "Other comprehensive smarthome systems (software and hardware)",
    "lighting": "light",
    "logic": "rules, scripts, parsers, scenes, ...",
    "messaging": "these adapters send and receive messages from message services: telegram, email, whatsapp, ...",
    "misc-data": "export/import of some unsorted information, contacts, systeminfo, gazoline prises, share curses, currents (EUR=>USD), ...",
    "multimedia": "TV, AV Receivers, TV play boxes, Android/apple TV boxes, multi-room music, IR controls, speech input/output, ...",
    "network": "ping, network detectors, UPnP, ...",
    "protocols": "Communication protocols: MQTT,",
    "storage": "logging, data protocols, SQL/NoSQL DBs, file storage, ...",
    "utility": "different help adapters. Like backup, export/import",
    "vehicle": "cars",
    "visualization": "visualisation, like vis, material, mobile",
    "visualization-icons": "icons for visualisation",
    "visualization-widgets": "iobroker.vis widgets",
    "weather": "weather info, air quality, environment statistics"
};

const reservedAdapterNames = [
    'config',
    'system',
    'alias',
    'design',
    'all',
    'self',
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
    'Zimbra-1.4',
    'zlib-acknowledgement',
    'Zlib',
    'ZPL-1.1',
    'ZPL-2.0',
    'ZPL-2.1',
];

// E1xx
function checkIOPackageJson(context) {
    context = context || {};
    return new Promise((resolve, reject) => {
        if (context.ioPackageJson) {
            return Promise.resolve(context.ioPackageJson);
        } else {
            return downloadFile(context.githubUrl, '/io-package.json')
                .then(packageJson => resolve(packageJson))
                .catch(e => reject(e));
        }
    }).then(ioPackageJson => {
        return new Promise(resolve => {
            context.ioPackageJson = ioPackageJson;
            if (typeof context.ioPackageJson === 'string') {
                try {
                    context.ioPackageJson = JSON.parse(context.ioPackageJson);
                } catch (e) {
                    context.errors.push('[E100] Cannot parse io-package.json: ' + e);
                    return resolve(context);
                }
            }

            if (!context.ioPackageJson.native) {
                context.errors.push('[E101] io-package.json must have at least empty "native" attribute');
            } else {
                context.checks.push('"native" found in io-package.json');
            }

            if (!context.ioPackageJson.common) {
                context.errors.push('[E102] io-package.json must have common object');
                return resolve(context);
            } else {
                context.checks.push('"common" found in io-package.json');
                if (!context.ioPackageJson.common ||
                    context.ioPackageJson.common.name !== context.adapterName.toLowerCase()) {
                    context.errors.push('[E103] common.name in io-package.json must be equal to "' + context.adapterName.toLowerCase() + '". Now is ' + context.ioPackageJson.common.name);
                } else {
                    context.checks.push('"common.name" is valid in io-package.json');
                }

                if (!context.ioPackageJson.common.title) {
                    context.errors.push('[E104] No common.title found in io-package.json');
                } else {
                    context.checks.push('"common.title" found in io-package.json');

                    if (context.ioPackageJson.common.title.match(/iobroker/i)) {
                        context.errors.push('[E105] Title should not have ioBroker in the name. It is clear, for what this adapter was created. Now: ' + context.ioPackageJson.common.title);
                    } else {
                        context.checks.push('"common.title" has no ioBroker in it in io-package.json');
                    }

                    if (context.ioPackageJson.common.title.match(/\sadapter|adapter\s/i)) {
                        context.errors.push('[E106] Title should not have word "adapter" in the name. It is clear, that this is adapter. Now: ' + context.ioPackageJson.common.title);
                    } else {
                        context.checks.push('"common.title" has no "adapter" in it in io-package.json');
                    }
                }

                if (!context.ioPackageJson.common.version) {
                    context.errors.push('[E107] No version found in io-package.json');
                } else {
                    context.checks.push('"common.version" found in io-package.json');
                }

                if (!context.ioPackageJson.common.desc) {
                    context.errors.push('[E108] No description found in io-package.json');
                } else {
                    context.checks.push('"common.desc" found in io-package.json');
                }

                if (typeof context.ioPackageJson.common.desc !== 'object') {
                    context.errors.push('[E109] desc in io-package.json should be an object for many languages. Found only ' + context.ioPackageJson.common.desc);
                } else {
                    context.checks.push('"common.desc" is multilingual in io-package.json');
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
                } else
                if (!context.ioPackageJson.common.onlyWWW) {
                    context.checks.push('"common.compact" found in io-package.json');
                }

                if (!context.ioPackageJson.common.materialize && !context.ioPackageJson.common.noConfig) {
                    context.errors.push('[E114] No adapter are allowed in the repo without admin3 support');
                } else {
                    context.checks.push('"common.materialize" found in io-package.json');
                }

                if (!context.ioPackageJson.common.license) {
                    context.errors.push('[E115] No license found in io-package.json');
                } else {
                    context.checks.push('"common.license" found in io-package.json');

                    // check if license valid
                    if (licenses.indexOf(context.ioPackageJson.common.license) === -1) {
                        context.errors.push('[E116] No SPDX license found. Please use one of listed here: https://spdx.org/licenses/');
                    } else {
                        context.checks.push('"common.license" is valid in io-package.json');
                    }

                    if (!context.packageJson ||
                        context.ioPackageJson.common.license !== context.packageJson.license) {
                        context.errors.push('[E117] Licenses in package.json and in io-package.json are different');
                    } else {
                        context.checks.push('"common.license" is equal in pacjage.json and in io-package.json');
                    }
                }

                if (!context.packageJson ||
                    context.ioPackageJson.common.version !== context.packageJson.version) {
                    context.errors.push('[E118] Versions in package.json and in io-package.json are different');
                } else {
                    context.checks.push('"common.version" is equal in package.json adn in io-package.json');
                }

                if (!context.ioPackageJson.common.type) {
                    context.errors.push('[E119] No type found in io-package.json');
                } else {
                    context.checks.push('"common.type" found in io-package.json');
                }

                if (!allowedTypes[context.ioPackageJson.common.type]) {
                    context.errors.push('[E120] Unknown type found in io-package.json');
                } else {
                    context.checks.push('"common.type" has known type in io-package.json');
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

                if (!context.ioPackageJson.common.news) {
                    context.errors.push('[E130] No news found in io-package.json');
                } else {
                    context.checks.push('"common.news" found in io-package.json');

                    if (Object.keys(context.ioPackageJson.common.news).length > 20) {
                        context.errors.push('[E130] Too many news found in io-package.json. Mast be less than 21. Please remove old news.');
                    }
                }

                // now check the package.json again, because it is valid only for onlyWWW
                if (!context.packageJson.main) {
                    !context.ioPackageJson.common.onlyWWW && context.errors.push('[E143] No main found in the package.json');
                } else {
                    context.checks.push('"main" found in package.json');
                }

                if (context.ioPackageJson.common.installedFrom) {
                    context.errors.push('[E144] common.installedFrom field found in io-package.json. Must be removed.');
                }

                if (context.ioPackageJson.common.extIcon) {
                    return downloadFile(context.ioPackageJson.common.extIcon, null, true)
                        .then(icon => {
                            const image = sizeOf(icon);
                            if (image.width !== image.height) {
                                context.errors.push('[E140] width and height of logo are not equal');
                            } else {
                                context.checks.push('Width and height of logo are equal');
                                if (image.width < 32) {
                                    context.errors.push('[E141] logo is too small. It mast be greater or equal than 32x32');
                                } else if (image.width >512) {
                                    context.errors.push('[E142] logo is too big. It mast be less or equal than 512x512');
                                }
                            }

                            context.checks.push('"extIcon" could be downloaded');
                            if (!context.ioPackageJson.onlyWWW && context.packageJson.main) {
                                return downloadFile(context.githubUrl, '/' + context.packageJson.main)
                                    .then(() => {
                                        context.checks.push(context.packageJson.main + ' could be downloaded');
                                    })
                                    .catch(err => {
                                        context.errors.push('[E124] Main file not found under URL: ' + context.githubUrl + '/' + context.packageJson.main);
                                    })
                                    .then(() => Promise.resolve(context));
                            } else {
                                return Promise.resolve(context);
                            }
                        })
                        .catch(err => {
                            context.errors.push('[E125] External icon not found under URL: ' + context.ioPackageJson.common.extIcon);
                        }).then(() => {
                            resolve(context);
                        });
                } else {
                    resolve(context);
                }
                // max number is E144
            }
        })
    });
}

// E2xx
function checkNpm(context) {
    return new Promise(resolve => {
        request('https://api.npms.io/v2/package/iobroker.' + context.adapterName, (err, status, body) => {
            if (!body) {
                context.errors.push('[E200] Not found on npm. Please publish');
                return resolve(context);
            }
            context.checks.push('Adapter found on npm');

            try {
                body = JSON.parse(body.toString());
            } catch (e) {
                context.errors.push('[E200] Cannot parse npm response');
                return resolve(context);
            }

            if (!body ||
                !body.collected ||
                !body.collected.metadata ||
                !body.collected.metadata.maintainers ||
                !body.collected.metadata.maintainers.length ||
                !body.collected.metadata.maintainers.find(user => user.username === 'bluefox' || user.username === 'iobluefox')) {
                context.errors.push(`[E201] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: "npm owner add bluefox iobroker.${context.adapterName}"`);
            } else {
                context.checks.push('Bluefox found in collaborators on NPM');
            }

            resolve(context);
            // max number is E201
        });
    });
}

// E3xx
function checkTravis(context) {
    return new Promise(resolve => {
        let travisURL = context.githubUrlOriginal.replace('github.com', 'api.travis-ci.org') + '.png';

        request(travisURL, (err, status, body) => {
            if (!status) {
                context.errors.push('[E300] Not found on travis. Please setup travis');
                return resolve(context);
            }
            if (!status.headers || !status.headers['content-disposition']){
                context.errors.push('[E300] Not found on travis. Please setup travis');
                return resolve(context);
            }
            // inline; filename="passing.png"
            const m = status.headers['content-disposition'].match(/filename="(.+)"$/);
            if (!m) {
                context.errors.push('[E300] Not found on travis. Please setup travis');
                return resolve(context);
            }

            if (m[1] === 'unknown.png') {
                context.errors.push('[E300] Not found on travis. Please setup travis');
                return resolve(context);
            }

            context.checks.push('Found on travis-ci');

            if (m[1] !== 'passing.png') {
                context.errors.push('[E301] Tests on Travis-ci.org are broken. Please fix.');
            } else {
                context.checks.push('Tests are OK on travis-ci');
            }

            resolve(context);
            // max number is E301
        });
    });
}

// E4xx
function checkRepo(context) {
    return new Promise(resolve => {
        if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.type) {
            // download latest repo
            request('https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json', (err, status, body) => {
                err && console.error(err);

                if (!body) {
                    context.errors.push('[E400] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json');
                } else {
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        console.error('Cannot parse sources-dist.json: ' + body);
                        context.errors.push('[E401] Cannot parse sources-dist.json');
                        body = null;
                    }

                    if (body) {
                        context.latestRepo = body;
                        if (!context.latestRepo[context.adapterName]) {
                            context.warnings.push('[W400] Cannot find "' + context.adapterName + '" in latest repository');
                        } else {
                            context.checks.push('Adapter found in latest repository');

                            if (context.latestRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                                context.errors.push('[E402] Types of adapter in latest repository and in io-package.json are different "' + context.latestRepo[context.adapterName].type + '" !== "' + context.ioPackageJson.common.type + '"');
                            } else {
                                context.checks.push('Types of adapter in latest repository and in io-package.json are equal: "' + context.latestRepo[context.adapterName].type + '"');
                            }

                            if (context.latestRepo[context.adapterName].version) {
                                context.errors.push('[E403] Version set in latest repository');
                            } else {
                                context.checks.push('Version does not set in latest repository');
                            }

                            const url = 'https://raw.githubusercontent.com/' + context.authorName + '/ioBroker.' + context.adapterName + '/master/';

                            if (!context.latestRepo[context.adapterName].icon) {
                                context.errors.push('[E404] Icon does not found in latest repository');
                            } else {
                                context.checks.push('Icon found in latest repository');

                                if (!context.latestRepo[context.adapterName].icon.startsWith(url)) {
                                    context.errors.push('[E405] Icon must be in the following path: '  + url);
                                } else {
                                    context.checks.push('Icon found in latest repository');
                                }
                            }
                            if (!context.latestRepo[context.adapterName].meta) {
                                context.errors.push('[E406] Meta URL(latest) not found in latest repository');
                            } else {
                                context.checks.push('Meta URL(latest) found in latest repository');

                                if (context.latestRepo[context.adapterName].meta !== url + 'io-package.json') {
                                    context.errors.push('[E407] Meta URL(latest) must be equal to '  + url + 'io-package.json');
                                } else {
                                    context.checks.push('Meta URL(latest) is OK in latest repository');
                                }
                            }
                        }
                    }
                }

                // download stable repo
                request('https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json', (err, status, body) => {
                    err && console.error(err);
                    if (!body) {
                        context.errors.push('[E420] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json');
                    } else {
                        try {
                            body = JSON.parse(body);
                        } catch (e) {
                            console.error('Cannot parse sources-dist.json: ' + body);
                            context.errors.push('[E421] Cannot parse sources-dist-stable.json');
                            body = null;
                        }

                        if (body) {
                            context.stableRepo = body;
                            if (context.stableRepo[context.adapterName]) {
                                if (context.stableRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                                    context.errors.push('[E422] Types of adapter in stable repository and in io-package.json are different "' + context.stableRepo[context.adapterName].type + '" !== "' + context.ioPackageJson.common.type + '"');
                                } else {
                                    context.checks.push('Types of adapter in stable repository and in io-package.json are equal: "' + context.stableRepo[context.adapterName].type + '"');
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
                                const url = 'https://raw.githubusercontent.com/' + context.authorName + '/ioBroker.' + context.adapterName + '/master/';

                                if (!context.stableRepo[context.adapterName].icon) {
                                    context.errors.push('[E425] Icon does not found in stable repository');
                                } else {
                                    context.checks.push('Icon found in stable repository');

                                    if (!context.stableRepo[context.adapterName].icon.startsWith(url)) {
                                        context.errors.push('[E426] Icon(stable) must be in the following path: '  + url);
                                    } else {
                                        context.checks.push('Icon(stable) found in latest repository');
                                    }
                                }
                                if (!context.stableRepo[context.adapterName].meta) {
                                    context.errors.push('[E427] Meta URL(stable) not found in latest repository');
                                } else {
                                    context.checks.push('Meta URL(stable) found in latest repository');

                                    if (context.stableRepo[context.adapterName].meta !== url + 'io-package.json') {
                                        context.errors.push('[E428] Meta URL(stable)  must be equal to '  + url + 'io-package.json');
                                    } else {
                                        context.checks.push('Meta URL(stable) is OK in latest repository');
                                    }
                                }
                            }
                        }
                    }
                    resolve(context);
                });
            });
        } else {
            resolve(context);
        }
        // max number is E428
    });
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
        const resultFunc = new Function('return ' + words + ';');

        return resultFunc();
    } catch (e) {
        return null;
    }
}

// E5xx
function checkCode(context) {
    const readFiles = ['.npmignore', '.gitignore', 'admin/index_m.html', 'iob_npm.done', 'admin/words.js'];
    if (context.packageJson.main) {
        readFiles.push(context.packageJson.main);
    }

    // https://github.com/userName/ioBroker.adaptername/archive/master.zip
    return new Promise((resolve, reject) => {
        return downloadFile(context.githubUrlOriginal, '/archive/master.zip', true)
            .then(data => {
                console.log('master.zip ' + data.length + ' bytes');
                let found = false;
                const bufferStream = new stream.PassThrough();
                bufferStream.end(data);
                context.filesList = [];

                const promises = [];

                return new Promise(_resolve => {
                    bufferStream
                        .pipe(unzip.Parse())
                        .on('entry', entry => {
                            // console.log('Check ' + entry.path);
                            if (!found && entry.type === 'Directory' && entry.path.match(/\/node_modules\/$/)) {
                                console.log('Found ' + entry.path);
                                found = true;
                                context.errors.push('[E500] node_modules found in repo. Please delete it');
                            }
                            // Get list of all files and .npmignore + .gitignore

                            const name = entry.path.replace(/^[^\/]+\//, '');
                            context.filesList.push(name);

                            if (readFiles.includes(name)) {
                                promises.push(new Promise(resolve => {
                                    const wstream = new WMStrm(name);
                                    wstream.on('finish', () => {
                                        context['/' + name] = memStore[name].toString();
                                        resolve(context['/' + name]);
                                    });
                                    entry.pipe(wstream);
                                }));
                            } else {
                                entry.autodrain();
                            }
                        })
                        .on('error', () => {
                            context.errors.push('[E501] Cannot get master.zip on github');
                            return Promise.all(promises).then(() => _resolve(context));
                        })
                        .on('close', () => {
                            return Promise.all(promises).then(() => _resolve(context));
                        });
                });
            })
            .then(context => {
                if (context['/admin/index_m.html'] && context['/admin/index_m.html'].includes('selectID.js') && !context.filesList.includes('admin/img/info-big.png')) {
                    context.errors.push('[E502] "admin/img/info-big.png" not found, but selectID.js used in index_m.html ');
                }
                if (context['/iob_npm.done']) {
                    context.errors.push('[E503] "iob_npm.done" found in repo! Please add it to .gitignore');
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
                }

                if (context.packageJson.main && context.packageJson.main.endsWith('.js')) {
                    if (!context['/' + context.packageJson.main]) {
                        context.errors.push('[E504] "' + context.packageJson.main + ' found in package.json, but not found as file');
                    } else {
                        if (context['/' + context.packageJson.main].includes('setInterval(') && !context['/' + context.packageJson.main].includes('clearInterval(')) {
                            context.errors.push('[E504] found setInterval in "' + context.packageJson.main + ', but no clearInterval detected');
                        }
                        if (context['/' + context.packageJson.main].includes('setTimeout(') && !context['/' + context.packageJson.main].includes('clearTimeout(')) {
                            context.warnings.push('[W505] setTimout found in "' + context.packageJson.main + ', but no clearTimeout detected');
                        }
                    }
                }
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
    return new Promise((resolve, reject) =>
        downloadFile(context.githubUrlOriginal, '/commits/master')
            .then(data => {
                const m = data.match(/Commits on [\w\s\d]+, (\d\d\d\d)/);
                if (m) {
                    context.lastCommitYear = m[1];
                }
                resolve(context);
            })
            .catch(e => reject(e)));
}

// E8xx
function checkGithubRepo(context) {
    return new Promise((resolve, reject) =>
        downloadFile(context.githubUrlOriginal, '')
            .then(data => {
                data = data.replace(/[\r\n]/g, '');
                let m = data.match(/itemprop="about">([^<]+)?<\/span/);
                if (!m || !m[1] || !m[1].trim()) {
                    context.errors.push(`[E801] No repository about text found. Please go to "${context.githubUrlOriginal}", press the first "Edit" button you will find on the page and add the description.`);
                } else {
                    context.checks.push('Github repository about found.');
                }

                m = data.replace(/[\r\n]/g, '').match(/list-topics-container[^"]*">/);
                if (!m) {
                    context.errors.push(`[E802] No topics found in the repository. Please go to "${context.githubUrlOriginal}" and press "Manage topics"`);
                } else {
                    context.checks.push('Github repository about found.');
                }

                resolve(context);
            })
            .catch(e => reject(e)));
}

// E6xx
function checkReadme(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/master/README.md
    return new Promise((resolve, reject) =>
        downloadFile(context.githubUrl, '/README.md')
            .then(data => {
                if (!data) {
                    context.errors.push('[E601] NO readme found');
                } else {
                    context.checks.push('README.md found');

                    if (data.indexOf('## Changelog') === -1) {
                        context.errors.push('[E603] NO "## Changelog" found in README.md');
                    } else {
                        context.checks.push('## Changelog found in README.md');
                    }
                    const pos = data.indexOf('## License');
                    if (pos === -1) {
                        context.errors.push('[E604] No "## License" found in README.md');
                    } else {
                        context.checks.push('## License found in README.md');
                        const text = data.substring(pos);
                        const year = new Date().getFullYear().toString();
                        if (text.indexOf(context.lastCommitYear || year) === -1) {
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
                    resolve(context);
                }
            })
            .catch(e => reject(e)));
}

// E7xx
function checkLicenseFile(context) {
    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/master/LICENSE
    return new Promise((resolve, reject) => {
        return downloadFile(context.githubUrl, '/LICENSE')
            .then(data => {
                if (!data) {
                    context.errors.push('[E701] NO LICENSE file found');
                } else {
                    context.checks.push('LICENSE file found');

                    if (context.packageJson.license === 'MIT') {
                        const year = new Date().getFullYear().toString();
                        if (data.indexOf(context.lastCommitYear || year) === -1) {
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

function paddingNum(num) {
    if (num >= 10) return num;
    return '0' + num;
}
// E8xx
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
// //        '.npmignore',
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

    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/master/.npmignore
    return new Promise((resolve, reject) => {
        if (!context.filesList.includes('.npmignore')) {
            context.warnings.push(`[W801] .npmignore not found`);
        } else {
            const rules = (context['/.npmignore'] || '').split('\n').map(line => line.trim().replace('\r', '')).filter(line => line);
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
                !check && context.errors.push(`[E802}] node_modules not found in .npmignore`);
            }
            if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
                !check && context.errors.push(`[E803}] iob_npm.done not found in .npmignore`);
            }

            checkFiles.forEach((file, i) => {
                if (context.filesList.includes(file)) {
                    // may be it is with regex
                    const check = rules.some(rule => {
                        if (typeof rule === 'string') {
                            return rule === file || rule === file.replace(/\/$/, '');
                        } else {
                            return rule.test(file);
                        }
                    });

                    !check && context.errors.push(`[E8${paddingNum(i + 11)}] file ${file} found in repository, but not found in .npmignore`);
                }
            });
        }
        resolve(context);
    });
}

// E9xx
function checkGitIgnore(context) {
    const checkFiles = [
        '.idea',
        'tmp',
        'node_modules',
        'iob_npm.done',
    ];

    // https://raw.githubusercontent.com/userName/ioBroker.adaptername/master/.gitignore
    return new Promise((resolve, reject) => {
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
                !check && context.errors.push(`[E902}] node_modules not found in .npmignore`);
            }
            if (!rules.includes('iob_npm.done') && !rules.includes('/iob_npm.done')) {
                !check && context.errors.push(`[E903}] iob_npm.done not found in .npmignore`);
            }

            checkFiles.forEach((file, i) => {
                if (context.filesList.includes(file)) {
                    // may be it is with regex
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
        resolve(context);
    });
}

function makeResponse(code, data, headers) {
    return {
        statusCode: code || 200,
        headers: {
            'Access-Control-Allow-Origin': '*', // Required for CORS support to work
            'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
        },
        body: typeof data === 'string' ? data : JSON.stringify(data)
    };
}

function check(request, context, callback) {
    console.log(JSON.stringify(request));
    if (!request.queryStringParameters.url) {
        return callback(null, makeResponse(500, {error: 'No github URL provided'}));
    } else {
        let ctx;
        checkPackageJson(request.queryStringParameters.url)
            .then(context => {
                ctx = context;
                return checkIOPackageJson(context)
            })
            .then(context => checkNpm(context))
            .then(context => checkTravis(context))
            .then(context => checkCommits(context))
            .then(context => checkRepo(context))
            .then(context => checkCode(context))
            .then(context => checkGithubRepo(context))
            .then(context => checkReadme(context))
            .then(context => checkLicenseFile(context))
            .then(context => checkNpmIgnore(context))
            .then(context => checkGitIgnore(context))
            .then(context => {
                console.log('OK');
                return callback(null, makeResponse(200, {result: 'OK', checks: context.checks, errors: context.errors, warnings: context.warnings}));
            })
            .catch(err => {
                console.error(err);
                if (ctx) {
                    return callback(null, makeResponse(501, {result: 'Errors found', checks: ctx.checks, errors: ctx.errors, warnings: ctx.warnings}));
                } else {
                    return callback(null, makeResponse(501, {result: 'Errors found', checks: [], errors: [err], warnings: []}));
                }
            });
    }
}

if (typeof module !== 'undefined' && module.parent) {
    exports.handler = check;
} else {
    check({queryStringParameters: {
        // url: 'https://github.com/ioBroker/ioBroker.tileboard',
        // url: 'https://github.com/AlCalzone/ioBroker.zwave2',
        url: 'https://github.com/klein0r/ioBroker.trashschedule',
        // url: 'https://github.com/bluerai/ioBroker.mobile-alerts'
    }}, null, (err, data) => {
        const context = JSON.parse(data.body);
        if (context.errors.length) {
            console.error(JSON.stringify(context.errors, null, 2));
        }
        console.log(JSON.stringify(data, null, 2));
    });
}


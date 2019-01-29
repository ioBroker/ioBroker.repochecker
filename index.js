/* 0.0.2 2019.01.23

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
if (typeof require !== 'undefined') {
    request = function (url, cb) {
        const https = require('https');
        https.get(url, resp => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => cb(null, {statusCode: resp.statusCode, headers: resp.headers}, data));
            resp.on('error', () => err => cb(err));
        }).on('error', err => cb(err));
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


function downloadFile(githubUrl, path) {
    return new Promise((resolve, reject) => {
        console.log('Download ' + githubUrl + (path || ''));
        request(githubUrl + (path || ''), (err, status, body) => {
            if (!err && status.statusCode === 200) {
                resolve(body.toString());
            } else {
                reject(err || status.statusCode);
            }
        });
    });
}

// check package.json
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
                    context.errors.push('Cannot parse packet.json: ' + e);
                    return resolve(context);
                }
            }

            if (!githubUrl.match(/\/iobroker\./i)) {
                context.errors.push('No "ioBroker." found in the name of repository');
            } else {
                context.checks.push('"ioBroker" was found in the name of repository');
            }

            if (githubUrl.indexOf('/iobroker.') !== -1) {
                context.errors.push('Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase');
            } else {
                context.checks.push('Repository has name ioBroker.adaptername (not iobroker.adaptername)');
            }

            const m = githubUrl.match(/\/ioBroker\.(.*)$/);
            let adapterName = '';
            if (!m || !m[1]) {
                context.errors.push('No adapter name found in URL: ' + githubUrl);
            } else {
                context.checks.push('Adapter name found in the URL');
                adapterName = m[1].replace(/\/master$/, '');
            }

            context.adapterName = adapterName;

            if (adapterName.match(/[A-Z]/)) {
                context.errors.push('Adapter name must be lowercase');
            } else {
                context.checks.push('Adapter name is lowercase');
            }

            if (adapterName.match(/[^-_a-z0-9]/)) {
                context.errors.push('Invalid characters found in adapter name "' + adapterName + '". Only lowercase chars, "-" and "_" are allowed');
            } else {
                context.checks.push('No invalid characters found in "' + adapterName + '"');
            }

            const n = githubUrl.match(/\/([^\/]+)\/iobroker\./i);
            if (!n || !n[1]) {
                context.errors.push('Cannot find author repo in the URL');
            } else {
                context.authorName = n[1];
            }

            if (githubUrl.indexOf('/iobroker.') !== -1) {
                context.errors.push('Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase');
            } else {
                context.checks.push('Repository URL has name  ioBroker.' + adapterName + ' and not iobroker.' + adapterName);
            }

            if (context.packageJson.name !== 'iobroker.' + adapterName) {
                context.errors.push('Name of adapter in package.json must be lowercase and be equal to "iobroker.' + adapterName + '". Now is "' + packageJson.name + '"');
            } else {
                context.checks.push('Name of adapter in package.json must be lowercase and be equal to "iobroker.' + adapterName + '".');
            }

            if (!context.packageJson.version) {
                context.errors.push('No version found in the package.json');
            } else {
                context.checks.push('Version found in package.json');
            }

            if (!context.packageJson.description) {
                context.errors.push('No description found in the package.json');
            } else {
                context.checks.push('Description found in package.json');
            }

            if (!context.packageJson.license) {
                context.errors.push('No license found in the package.json');
            } else {
                context.checks.push('License found in package.json');
            }

            if (!context.packageJson.main) {
                context.errors.push('No main found in the package.json');
            } else {
                context.checks.push('"main" found in package.json');
            }

            if (!context.packageJson.author) {
                context.errors.push('No author found in the package.json');
            } else {
                context.checks.push('Author found in package.json');
            }

            if (context.packageJson._args) {
                context.errors.push('NPM information found in package.json. Please remove all attributes starting with "_"');
            } else {
                context.checks.push('No npm generated attributes found in package.json');
            }

            if (!context.packageJson.license) {
                context.errors.push('No license found in package.json');
            } else {
                context.checks.push('"license" found in package.json');

                // check if license valid
                if (licenses.indexOf(context.packageJson.license) === -1) {
                    context.errors.push('No SPDX license found in package.json. Please use one of listed here: https://spdx.org/licenses/');
                } else {
                    context.checks.push('"license" is valid in package.json');
                }
            }

            if (!context.packageJson.repository) {
                context.errors.push('No repository found in the package.json');
            } else {
                context.checks.push('Repository found in package.json');

                if (context.packageJson.repository.type !== 'git') {
                    context.errors.push('Invalid repository type: ' + context.packageJson.repository.type + '. It should be git');
                } else {
                    context.checks.push('Repository type is valid: git');
                }

                if (context.packageJson.repository.url.indexOf(context.githubUrlOriginal) === -1) {
                    context.errors.push('Invalid repository URL: ' + context.packageJson.repository.url + '. Expected: git+' + context.githubUrlOriginal + '.git');
                } else {
                    context.checks.push('Repository URL is valid in package.json');
                }
            }

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
    "visualization": "visualisation, like vis, material, mobile",
    "visualization-icons": "icons for visualisation",
    "visualization-widgets": "iobroker.vis widgets",
    "weather": "weather info, air quality, environment statistics"
};

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
                    context.errors.push('Cannot parse io-package.json: ' + e);
                    return resolve(context);
                }
            }

            if (!context.ioPackageJson.native) {
                context.errors.push('io-package.json must have at least empty "native" attribute');
            } else {
                context.checks.push('"native" found in io-package.json');
            }

            if (!context.ioPackageJson.common) {
                context.errors.push('io-package.json must have common object');
                return resolve(context);
            } else {
                context.checks.push('"common" found in io-package.json');
                if (!context.ioPackageJson.common ||
                    context.ioPackageJson.common.name !== context.adapterName) {
                    context.errors.push('common.name in io-package.json must be equal to "' + context.adapterName + '". Now is ' + context.ioPackageJson.common.name);
                } else {
                    context.checks.push('"common.name" is valid in io-package.json');
                }

                if (!context.ioPackageJson.common.title) {
                    context.errors.push('No common.title found in io-package.json');
                } else {
                    context.checks.push('"common.title" found in io-package.json');

                    if (context.ioPackageJson.common.title.match(/iobroker/i)) {
                        context.errors.push('Title should not have ioBroker in the name. It is clear, for what this adapter was created. Now: ' + context.ioPackageJson.common.title);
                    } else {
                        context.checks.push('"common.title" has no ioBroker in it in io-package.json');
                    }

                    if (context.ioPackageJson.common.title.match(/\sadapter|adapter\s/i)) {
                        context.errors.push('Title should not have word "adapter" in the name. It is clear, that this is adapter. Now: ' + context.ioPackageJson.common.title);
                    } else {
                        context.checks.push('"common.title" has no "adapter" in it in io-package.json');
                    }
                }

                if (!context.ioPackageJson.common.version) {
                    context.errors.push('No version found in io-package.json');
                } else {
                    context.checks.push('"common.version" found in io-package.json');
                }

                if (!context.ioPackageJson.common.desc) {
                    context.errors.push('No description found in io-package.json');
                } else {
                    context.checks.push('"common.desc" found in io-package.json');
                }

                if (typeof context.ioPackageJson.common.desc !== 'object') {
                    context.errors.push('desc in io-package.json should be an object for many languages. Found only ' + context.ioPackageJson.common.desc);
                } else {
                    context.checks.push('"common.desc" is multilingual in io-package.json');
                }

                if (!context.ioPackageJson.common.icon) {
                    context.errors.push('Icon not found in the io-package.json');
                } else {
                    context.checks.push('"common.icon" found in io-package.json');
                }

                if (!context.ioPackageJson.common.extIcon) {
                    context.errors.push('extIcon not found in the io-package.json');
                } else {
                    context.checks.push('"common.extIcon" found in io-package.json');

                    if (!context.ioPackageJson.common.extIcon ||
                        context.ioPackageJson.common.icon !== context.ioPackageJson.common.extIcon.substring(context.ioPackageJson.common.extIcon.length - context.ioPackageJson.common.icon.length)) {
                        context.errors.push('extIcon must be the same as an icon but with github path');
                    } else {
                        context.checks.push('"common.extIcon" has same path as repo in io-package.json');
                    }
                }

                if (!context.ioPackageJson.common.compact && !context.ioPackageJson.common.onlyWWW) {
                    context.warnings.push('Adapter should support compact mode');
                } else
                if (!context.ioPackageJson.common.onlyWWW) {
                    context.checks.push('"common.compact" found in io-package.json');
                }

                if (!context.ioPackageJson.common.materialize) {
                    context.errors.push('No adapter are allowed in the repo without admin3 support');
                } else {
                    context.checks.push('"common.materialize" found in io-package.json');
                }

                if (!context.ioPackageJson.common.license) {
                    context.errors.push('No license found in io-package.json');
                } else {
                    context.checks.push('"common.license" found in io-package.json');

                    // check if license valid
                    if (licenses.indexOf(context.ioPackageJson.common.license) === -1) {
                        context.errors.push('No SPDX license found. Please use one of listed here: https://spdx.org/licenses/');
                    } else {
                        context.checks.push('"common.license" is valid in io-package.json');
                    }

                    if (!context.packageJson ||
                        context.ioPackageJson.common.license !== context.packageJson.license) {
                        context.errors.push('Licenses in package.json and in io-package.json are different');
                    } else {
                        context.checks.push('"common.license" is equal in pacjage.json and in io-package.json');
                    }
                }

                if (!context.packageJson ||
                    context.ioPackageJson.common.version !== context.packageJson.version) {
                    context.errors.push('Versions in package.json and in io-package.json are different');
                } else {
                    context.checks.push('"common.version" is equal in package.json adn in io-package.json');
                }

                if (!context.ioPackageJson.common.type) {
                    context.errors.push('No type found in io-package.json');
                } else {
                    context.checks.push('"common.type" found in io-package.json');
                }

                if (!allowedTypes[context.ioPackageJson.common.type]) {
                    context.errors.push('Unknown type found in io-package.json');
                } else {
                    context.checks.push('"common.type" has known type in io-package.json');
                }

                if (!context.ioPackageJson.common.authors) {
                    context.errors.push('No authors found in io-package.json');
                } else {
                    context.checks.push('"common.authors" found in io-package.json');

                    if (!(context.ioPackageJson.common.authors instanceof Array)) {
                        context.errors.push('authors must be an Array in io-package.json');
                    } else {
                        context.checks.push('"common.authors" is array in io-package.json');
                    }

                    if (!context.ioPackageJson.common.authors.length) {
                        context.errors.push('Authors may not be empty in io-package.json');
                    } else {
                        context.checks.push('"common.authors" is not empty in io-package.json');
                    }
                }

                if (context.ioPackageJson.common.extIcon) {
                    return downloadFile(context.ioPackageJson.common.extIcon)
                        .then(() => {
                            context.checks.push('"extIcon" could be downloaded');
                            if (!context.ioPackageJson.onlyWWW) {
                                return downloadFile(context.githubUrl, '/' + context.packageJson.main)
                                    .then(() => {
                                        context.checks.push(context.packageJson.main + ' could be downloaded');
                                    })
                                    .catch(err => {
                                        context.errors.push('Main file not found under URL: ' + context.githubUrl + '/' + context.packageJson.main);
                                    })
                                    .then(() => Promise.resolve(context));
                            } else {
                                return Promise.resolve(context);
                            }
                        })
                        .catch(err => {
                            context.errors.push('External icon not found under URL: ' + context.ioPackageJson.common.extIcon);
                        }).then(() => {
                            resolve(context);
                        });
                } else {
                    resolve(context);
                }
            }
        })
    });
}

function checkNpm(context) {
    return new Promise(resolve => {
        request('https://www.npmjs.com/package/iobroker.' + context.adapterName, (err, status, body) => {
            if (!body) {
                context.errors.push('Not found on npm. Please publish');
                return resolve(context);
            }
            context.checks.push('Adapter found on npm');

            body = body.toString();
            const m = body.match(/>collaborators<(.*)<\/ul>/);
            if (m) {
                if (m[1].indexOf('title="bluefox"') === -1 && m[1].indexOf('title="iobluefox"') === -1) {
                    context.errors.push('Bluefox is not in the collaborators!. Please add.');
                } else {
                    context.checks.push('Bluefox found in collaborators');
                }
            } else {
                context.errors.push('Bluefox is not in the collaborators!. Please add.');
            }
            resolve(context);
        });
    });
}

function checkTravis(context) {
    return new Promise(resolve => {
        let travisURL = context.githubUrlOriginal.replace('github.com', 'api.travis-ci.org') + '.png';

        request(travisURL, (err, status, body) => {
            if (!status) {
                context.errors.push('Not found on travis. Please setup travis');
                return resolve(context);
            }
            if (!status.headers || !status.headers['content-disposition']){
                context.errors.push('Not found on travis. Please setup travis');
                return resolve(context);
            }
            // inline; filename="passing.png"
            const m = status.headers['content-disposition'].match(/filename="(.+)"$/);
            if (!m) {
                context.errors.push('Not found on travis. Please setup travis');
                return resolve(context);
            }

            if (m[1] === 'unknown.png') {
                context.errors.push('Not found on travis. Please setup travis');
                return resolve(context);
            }

            context.checks.push('Found on travis-ci');

            if (m[1] !== 'passing.png') {
                context.errors.push('Tests on Travis-ci.org are broken. Please fix.');
            } else {
                context.checks.push('Tests are OK on travis-ci');
            }

            resolve(context);
        });
    });
}

function checkRepo(context) {
    return new Promise(resolve => {
        if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.type) {
            // download latest repo
            request('https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json', (err, status, body) => {
                err && console.error(err);

                if (!body) {
                    context.errors.push('Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json');
                } else {
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        console.error('Cannot parse sources-dist.json: ' + body);
                        context.errors.push('Cannot parse sources-dist.json');
                        body = null;
                    }

                    if (body) {
                        context.latestRepo = body;
                        if (!context.latestRepo[context.adapterName]) {
                            context.warnings.push('Cannot find "' + context.adapterName + '" in latest repository');
                        } else {
                            context.checks.push('Adapter found in latest repository');

                            if (context.latestRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                                context.errors.push('Types of adapter in latest repository and in io-package.json are different "' + context.latestRepo[context.adapterName].type + '" !== "' + context.ioPackageJson.common.type + '"');
                            } else {
                                context.checks.push('Types of adapter in latest repository and in io-package.json are equal: "' + context.latestRepo[context.adapterName].type + '"');
                            }

                            if (context.latestRepo[context.adapterName].version) {
                                context.errors.push('Version set in latest repository');
                            } else {
                                context.checks.push('Version does not set in latest repository');
                            }

                            const url = 'https://raw.githubusercontent.com/' + context.authorName + '/ioBroker.' + context.adapterName + '/master/';

                            if (!context.latestRepo[context.adapterName].icon) {
                                context.errors.push('Icon does not found in latest repository');
                            } else {
                                context.checks.push('Icon found in latest repository');

                                if (!context.latestRepo[context.adapterName].icon.startsWith(url)) {
                                    context.errors.push('Icon must be in the following path: '  + url);
                                } else {
                                    context.checks.push('Icon found in latest repository');
                                }
                            }
                            if (!context.latestRepo[context.adapterName].meta) {
                                context.errors.push('Meta URL(latest) not found in latest repository');
                            } else {
                                context.checks.push('Meta URL(latest) found in latest repository');

                                if (context.latestRepo[context.adapterName].meta !== url + 'io-package.json') {
                                    context.errors.push('Meta URL(latest) must be equal to '  + url + 'io-package.json');
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
                        context.errors.push('Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json');
                    } else {
                        try {
                            body = JSON.parse(body);
                        } catch (e) {
                            console.error('Cannot parse sources-dist.json: ' + body);
                            context.errors.push('Cannot parse sources-dist-stable.json');
                            body = null;
                        }

                        if (body) {
                            context.stableRepo = body;
                            if (context.stableRepo[context.adapterName]) {
                                if (context.stableRepo[context.adapterName].type !== context.ioPackageJson.common.type) {
                                    context.errors.push('Types of adapter in stable repository and in io-package.json are different "' + context.stableRepo[context.adapterName].type + '" !== "' + context.ioPackageJson.common.type + '"');
                                } else {
                                    context.checks.push('Types of adapter in stable repository and in io-package.json are equal: "' + context.stableRepo[context.adapterName].type + '"');
                                }

                                if (!context.latestRepo[context.adapterName]) {
                                    context.errors.push('Adapter was found in stable repository but not in latest repo');
                                } else {
                                    context.checks.push('Adapter was found in stable repository and in latest repo');
                                }

                                if (!context.stableRepo[context.adapterName].version) {
                                    context.errors.push('No version set in stable repository');
                                } else {
                                    context.checks.push('Version found in stable repository');
                                }
                                const url = 'https://raw.githubusercontent.com/' + context.authorName + '/ioBroker.' + context.adapterName + '/master/';

                                if (!context.stableRepo[context.adapterName].icon) {
                                    context.errors.push('Icon does not found in stable repository');
                                } else {
                                    context.checks.push('Icon found in stable repository');

                                    if (!context.stableRepo[context.adapterName].icon.startsWith(url)) {
                                        context.errors.push('Icon(stable) must be in the following path: '  + url);
                                    } else {
                                        context.checks.push('Icon(stable) found in latest repository');
                                    }
                                }
                                if (!context.stableRepo[context.adapterName].meta) {
                                    context.errors.push('Meta URL(stable) not found in latest repository');
                                } else {
                                    context.checks.push('Meta URL(stable) found in latest repository');

                                    if (context.stableRepo[context.adapterName].meta !== url + 'io-package.json') {
                                        context.errors.push('Meta URL(stable)  must be equal to '  + url + 'io-package.json');
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
            .then(context => checkRepo(context))
            .then(context => {
                console.log('OK');
                return callback(null, makeResponse(200, {result: 'OK', checks: context.checks, errors: context.errors}));
            })
            .catch(err => {
                console.error(err);
                return callback(null, makeResponse(501, {result: 'Errors found', checks: ctx.checks, errors: ctx.errors}));
            });
    }
}

if (typeof module !== 'undefined' && module.parent) {
    exports.handler = check;
} else {
    check({queryStringParameters: {
        url: 'https://github.com/ioBroker/ioBroker.admin'
    }}, null, (err, data) => {
        console.log(JSON.stringify(data, null, 2));
    });
}


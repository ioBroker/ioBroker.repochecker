const request = require('request');

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
    context = context || {};
    if (githubUrl.match(/\/$/)) {
        githubUrl = githubUrl.substring(0, githubUrl.length - 1);
    }
    context.githubUrlOriginal = githubUrl;
    githubUrl = githubUrl.replace('https://github.com', 'https://raw.githubusercontent.com');
    githubUrl = githubUrl + '/master';
    context.githubUrl = githubUrl;
    return new Promise((resolve, reject) => {
        if (context.packageJson) {
            return Promise.resolve(context.packageJson);
        } else {
            return downloadFile(githubUrl, '/package.json').then(packageJson => resolve(packageJson));
        }
    }).then(packageJson => {
        return new Promise((resolve, reject) => {
            context.packageJson = packageJson;
            if (typeof context.packageJson === 'string') {
                try {
                    context.packageJson = JSON.parse(context.packageJson);
                } catch (e) {
                    return reject('Cannot parse packet.json: ' + e);
                }
            }

            if (!githubUrl.match(/\/iobroker\./i)) {
                return reject('No "ioBroker." found in the name of repository');
            }

            if (githubUrl.indexOf('/iobroker.') !== -1) {
                return reject('Repository must have name ioBroker.adaptername, but now io"b"roker is in lowercase');
            }
            const m = githubUrl.match(/\/ioBroker\.(.*)$/);
            if (!m || !m[1]) {
                return reject('No adapter name found in URL: ' + githubUrl);
            }

            const adapterName = m[1].replace(/\/master$/, '');

            context.adapterName = adapterName;

            if (adapterName.match(/[A-Z]/)) {
                return reject('Adapter name must be lowercase');
            }
            if (adapterName.match(/[^-_a-z0-9]/)) {
                return reject('Invalid characters found in adapter name "' + adapterName + '". Only lowercase chars, "-" and "_" are allowed');
            }

            if (githubUrl.indexOf('/iobroker.') !== -1) {
                return reject('Repositiry must have name ioBroker.adaptername, but now io"b"roker is in lowercase');
            }
            if (context.packageJson.name !== 'iobroker.' + adapterName) {
                return reject('Name of adapter in package.json must be lowercase and be equal to "iobroker.' + adapterName + '". Now is "' + packageJson.name + '"');
            }
            if (!context.packageJson.version) {
                return reject('No version found in the package.json');
            }
            if (!context.packageJson.description) {
                return reject('No description found in the package.json');
            }
            if (!context.packageJson.license) {
                return reject('No license found in the package.json');
            }
            if (!context.packageJson.main) {
                return reject('No main found in the package.json');
            }
            if (!context.packageJson.author) {
                return reject('No author found in the package.json');
            }
            if (!context.packageJson.repository) {
                return reject('No repository found in the package.json');
            }
            if (context.packageJson.repository.type !== 'git') {
                return reject('Invalid repository type: ' + context.packageJson.repository.type + '. It should be git');
            }
            if (context.packageJson.repository.url.indexOf(context.githubUrlOriginal) === -1) {
                return reject('Invalid repository URL: ' + context.packageJson.repository.url + '. Expected: ' + githubUrl);
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

function checkIOPackageJson(context) {
    context = context || {};
    return new Promise((resolve, reject) => {
        if (context.ioPackageJson) {
            return Promise.resolve(context.ioPackageJson);
        } else {
            return downloadFile(context.githubUrl, '/io-package.json').then(packageJson => resolve(packageJson));
        }
    }).then(ioPackageJson => {
        return new Promise((resolve, reject) => {
            context.ioPackageJson = ioPackageJson;
            if (typeof context.ioPackageJson === 'string') {
                try {
                    context.ioPackageJson = JSON.parse(context.ioPackageJson);
                } catch (e) {
                    return reject('Cannot parse io-package.json: ' + e);
                }
            }

            if (!context.ioPackageJson.common) {
                return reject('io-package.json must have common object');
            }
            if (context.ioPackageJson.common.name !== context.adapterName) {
                return reject('common.name in io-package.json must be equal to "' + context.adapterName + '". Now is ' + context.ioPackageJson.common.name);
            }
            if (!context.ioPackageJson.common.title) {
                return reject('No common.title found in io-package.json');
            }
            if (context.ioPackageJson.common.title.match(/iobroker/i)) {
                return reject('Title should not have ioBroker in the name. It is clear, for what this adapter was created. Now: ' + context.ioPackageJson.common.title);
            }
            if (context.ioPackageJson.common.title.match(/\sadapter|adapter\s/i)) {
                return reject('Title should not have word "adapter" in the name. It is clear, that this is adapter. Now: ' + context.ioPackageJson.common.title);
            }
            if (!context.ioPackageJson.common.version) {
                return reject('No version found in io-package.json');
            }
            if (!context.ioPackageJson.common.desc) {
                return reject('No description found in io-package.json');
            }
            if (typeof context.ioPackageJson.common.desc !== 'object') {
                return reject('desc in io-package.json should be an object for many lanuages. Found only ' + context.ioPackageJson.common.desc);
            }
            if (!context.ioPackageJson.common.icon) {
                return reject('Icon not found in the io-package.json');
            }
            if (!context.ioPackageJson.common.extIcon) {
                return reject('extIcon not found in the io-package.json');
            }
            if (context.ioPackageJson.common.icon !== context.ioPackageJson.common.extIcon.substring(context.ioPackageJson.common.extIcon.length - context.ioPackageJson.common.icon.length)) {
                return reject('extIcon must be the same as an icon but with github path');
            }
            if (!context.ioPackageJson.common.compact && !context.ioPackageJson.common.onlyWWW) {
                return reject('Adapter should support compact mode');
            }
            if (!context.ioPackageJson.common.materialize) {
                return reject('No adapter are allowed in the repo without admin3 support');
            }
            if (!context.ioPackageJson.common.license) {
                return reject('No license found');
            }
            if (context.ioPackageJson.common.license !== context.packageJson.license) {
                return reject('Licenses in package.json and in io-package.json are different');
            }
            if (context.ioPackageJson.common.version !== context.packageJson.version) {
                return reject('Versions in package.json and in io-package.json are different');
            }
            if (!context.ioPackageJson.common.type) {
                return reject('No type found in io-package.json');
            }
            if (!allowedTypes[context.ioPackageJson.common.type]) {
                return reject('Unknown type found in io-package.json');
            }
            if (!context.ioPackageJson.common.authors) {
                return reject('No authors found in io-package.json');
            }
            if (!(context.ioPackageJson.common.authors instanceof Array)) {
                return reject('authors must be an Array in io-package.json');
            }
            if (!context.ioPackageJson.common.authors.length) {
                return reject('Authors may not be empty in io-package.json');
            }
            if (!context.ioPackageJson.native) {
                return reject('io-package.json must have at least empty "native" attribute');
            }

            return downloadFile(context.ioPackageJson.common.extIcon)
                .then(() => {
                    resolve(context);
                })
                .catch(err => {
                    reject('External icon not found under URL: ' + context.ioPackageJson.common.extIcon);
                });
        })
    });
}

function checkNpm(context) {
    return new Promise((resolve, reject) => {
        request('https://www.npmjs.com/package/iobroker.' + context.adapterName, (err, status, body) => {
            if (!body) {
                return reject('Not found on npm. Please publish');
            }
            body = body.toString();
            const m = body.match(/>collaborators<(.*)<\/ul>/);
            if (m) {
                if (m[1].indexOf('title="bluefox"') === -1 && m[1].indexOf('title="iobluefox"') === -1) {
                    return reject('Bluefox is not in the collaborators!. Please add.');
                }
            } else {
                return reject('Bluefox is not in the collaborators!. Please add.');
            }
            resolve(context);
        });
    });
}

function post(request, context, callback) {
    if (!request.queryStringParameters.url) {
        return callback(null, {
            statusCode: 500,
            body: JSON.stringify({error: 'No github URL provided'})
        });
    } else {
        checkPackageJson(request.queryStringParameters.url)
            .then(context => checkIOPackageJson(context))
            .then(context => checkNpm(context))
            .then(() => {
                return callback(null, {
                    statusCode: 200,
                    body: JSON.stringify({result: 'OK'})
                });
            })
            .catch(err => {
                return callback(null, {
                    statusCode: 501,
                    body: JSON.stringify({error: err.toString()})
                });
            });
    }
}
if (module.parent) {
    exports.handler = post;
} else {
    post({queryStringParameters: {
        url: 'https://github.com/ioBroker/ioBroker.admin'
    }}, null, (err, data) => {
        console.log(JSON.stringify(data, null, 2));
    });
}


'use strict';
/*
    This module contains genaral utility routines for iobroker.repochecker

*/
const axios = require('axios');
const fs = require('node:fs/promises');
const compareVersions = require('compare-versions');

// disable axios caching
axios.defaults.headers = {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
};

let gDebug = false;
function setDebug(flag) {
    gDebug = flag;
}

function debug(msg) {
    gDebug && console.log(`[DEBUG] ${msg}`);
}

let gLocal = false;
function setLocal(flag) {
    gLocal = flag;
}
function isLocal() {
    return gLocal;
}
function checkLanguages(langObj, languages) {
    return languages.filter(lang => !langObj[lang]);
}

async function downloadFile(githubUrl, path, binary, noError) {

    if (!isLocal()) {
        console.log(`Download ${githubUrl}${path || ''}`);
        const options = {};
        if (binary) {
            options.responseType = 'arraybuffer';
        }
        try {
            const response = await axios(githubUrl + (path || ''), options);
            debug(`download succeded`);
            return (response.data);
        } catch (e) {
            (!noError || gDebug) && console.error(`Cannot download ${githubUrl}${path || ''} ${e}`);
            throw e;
        }
    } else {
        console.log(`Download local ${path || ''}`);
        // remove first / from path
        path = path.replace(/^\/+/, '');
        const file = await fs.readFile(path, binary ? null : 'utf8');
        return file;
    }
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
    console.log(`deps: ${JSON.stringify(deps)}, type ${typeof deps}`);
    if (deps instanceof Array) {
        for (const dep of deps) {
            if (typeof dep === 'object') {
                for (const key in dep) {
                    ret[key] = dep[key];
                }
            } else {
                ret[dep] = '>=0';
            }
        }
    }
    console.log(`ret: ${JSON.stringify(ret)}`);
    return ret;
}

/*
    return the greater of two semver versions
*/
function maxVersion(v1, v2) {
    if (compareVersions.compareVersions(v1, v2) > 0) {
        return v1;
    }
    return v2;
}

exports.setDebug = setDebug;
exports.debug = debug;
exports.setLocal = setLocal;
exports.isLocal = isLocal;

exports.checkLanguages = checkLanguages;
exports.downloadFile = downloadFile;
exports.getDependencyArray = getDependencyArray;
exports.getDependencies = getDependencies;
exports.maxVersion = maxVersion;


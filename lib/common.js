'use strict';
/*
    This module contains genaral utility routines for iobroker.repochecker

*/
const axios = require('axios');
const fs = require('node:fs/promises');
const compareVersions = require('compare-versions');
const semverValid = require('semver/functions/valid');

// disable axios caching
axios.defaults.headers.common = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
};

let gDebug = false;
function setDebug(flag) {
    gDebug = flag;
    debug('debug messages have been enabled');
}

function debug(msg) {
    gDebug && console.log(`[DEBUG] ${msg}`);
}

let gLocal = false;
function setLocal(flag) {
    gLocal = flag;
    console.log(`[INFO] running in LOCAL mode`);
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
            return response.data;
        } catch (e) {
            (!noError || gDebug) && console.error(`Cannot download ${githubUrl}${path || ''} ${e}`);
            return '';
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
        .map(dep => (typeof dep === 'object' ? Object.keys(dep) : [dep]))
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

/*
    analyzes a semver string
*/
function parseSemver(p_semver) {
    // console.log(`parseSemver(${p_semver})`);
    const ret = {
        valid: false,
        rangeOp: '',
        trimmed: false,
        version: '',
    };

    const semver = p_semver.trim();
    ret.trimmed = semver !== p_semver;
    ret.version = semver;
    ret.uncompressed = false;

    const m = semver.match(/^(\^|~|>|>=|<|<=)?(\s*)(.*)$/);
    if (m) {
        // console.log(m);
        ret.rangeOp = m[1];
        ret.uncompressed = m[2] !== '';
        ret.version = m[3];
    }
    ret.version = semverValid(ret.version) || '';
    ret.valid = semverValid(ret.version) !== undefined;
    // console.log(JSON.stringify(ret));
    return ret;
}

function validateSemver(p_semver) {
    //console.log(`validateSemver(${p_semver})`);
    const ret = parseSemver(p_semver);
    return ret.valid && !ret.uncompressed;
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
exports.parseSemver = parseSemver;
exports.validateSemver = validateSemver;

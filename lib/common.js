'use strict';
/*
    This module contains genaral utility routines for iobroker.repochecker

*/
const axios = require('axios');
const fs = require('node:fs/promises');
const compareVersions = require('compare-versions');
const semverValid = require('semver/functions/valid');

let gDebug = false;
let gInfo = true;
let gSuccess = false;
let gLocal = false;

// disable axios caching
axios.defaults.headers.common = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
    // Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
};

if (process.env.OWN_GITHUB_TOKEN) {
    info('using authorization defined by OWN_GITHUB_TOKEN');
    axios.defaults.headers.common['Authorization'] = `Bearer ${process.env.OWN_GITHUB_TOKEN}`;
}

// function log(msg) {
//     console.log(`${msg}`);
// }

function debug(msg) {
    gDebug && console.log(`${msg ? '[DEBUG] ' : ''}${msg}`);
}

function info(msg) {
    gInfo && console.log(`${msg ? '[INFO] ' : ''}${msg}`);
}

function warn(msg) {
    console.log(`${msg ? '[WARNING] ' : ''}${msg}`);
}

function error(msg) {
    console.error(`${msg ? '[ERROR] ' : ''}${msg}`);
}

function isDebug() {
    return gDebug;
}

function isInfo() {
    return gInfo;
}

function isSuccess() {
    return gSuccess;
}

function isLocal() {
    return gLocal;
}

function setDebug(flag) {
    gDebug = flag;
    debug('debug messages have been enabled');
}

function setInfo(flag) {
    gInfo = flag;
    console.log(`[INFO] info messages have been ${gInfo ? 'enabled' : 'disabled'}`);
}

function setSuccess(flag) {
    gInfo = flag;
    console.log(`[INFO] success messages have been ${gSuccess ? 'enabled' : 'disabled'}`);
}

function setLocal(flag) {
    gLocal = flag;
    info(`running in LOCAL mode`);
}

function checkLanguages(langObj, languages) {
    return languages.filter(lang => !langObj[lang]);
}

async function downloadURL(url, binary) {
    debug(`Download file ${url} ${binary ? ' using binary mode' : ''})`);
    const options = {};
    options.responseType = binary ? 'arraybuffer' : 'text';
    try {
        //const response = await axios(githubUrl + (path || ''), options);
        // @ts-expect-error options work this way
        const response = await axios(url, options);
        debug(`Download succeded`);
        return response.data;
    } catch (e) {
        error(`Cannot download ${url} ${e}`);
        return '';
    }
}

async function getFile(context, path, binary) {
    let file;
    if (!isLocal()) {
        const url = context
            ? `https://cdn.jsdelivr.net/gh/${context.repository}@${context.lastCommitSha}${path || ''}`
            : path;
        file = await downloadURL(url, binary);
    } else {
        debug(`Download local ${path || ''}`);
        // remove first / from path
        path = path.replace(/^\/+/, '');
        file = await fs.readFile(path, binary ? null : 'utf8');
    }
    return file;
}

async function getFilesList(context) {
    const url = `https://data.jsdelivr.com/v1/packages/gh/${context.repository}@${context.lastCommitSha}?structure=flat`;
    debug(`Download ${url}`);
    const filesList = [];
    try {
        const response = await axios(url);
        debug(`download succeded`);
        if (response.data?.files) {
            response.data.files.forEach(fileInfo => filesList.push(fileInfo.name));
        }
    } catch (e) {
        error(`Cannot download ${url} ${e}`);
    }

    debug('Files detected at repository:');
    filesList.forEach(filename => debug(`    ${filename}`));

    return filesList;
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
    debug(`deps: ${JSON.stringify(deps)}, type ${typeof deps}`);
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
    debug(`ret: ${JSON.stringify(ret)}`);
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

exports.debug = debug;
exports.info = info;
exports.error = error;
exports.warn = warn;

exports.isDebug = isDebug;
exports.isInfo = isInfo;
exports.isSuccess = isSuccess;
exports.isLocal = isLocal;

exports.setDebug = setDebug;
exports.setInfo = setInfo;
exports.setSuccess = setSuccess;
exports.setLocal = setLocal;

exports.checkLanguages = checkLanguages;
exports.downloadURL = downloadURL;
exports.getFile = getFile;
exports.getFilesList = getFilesList;
exports.getDependencyArray = getDependencyArray;
exports.getDependencies = getDependencies;
exports.maxVersion = maxVersion;
exports.parseSemver = parseSemver;
exports.validateSemver = validateSemver;

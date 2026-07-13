'use strict';
/*
    This module contains general utility routines for iobroker.repochecker

*/
const axios = require('axios');
const fs = require('node:fs/promises');
const compareVersions = require('compare-versions');
const semver = require('semver');
const semverValid = require('semver/functions/valid');
const githubToken = process.env.OWN_GITHUB_TOKEN;
const redactedValue = '***REDACTED***';

let gDebug = false;
let gInfo = true;
let gSuccess = false;
let gLocal = false;
let gStrict = false;
const githubHostnames = new Set([
    'github.com',
    'api.github.com',
    'gist.github.com',
    'codeload.github.com',
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'objects.githubusercontent.com',
    'uploads.github.com',
    'avatars.githubusercontent.com',
    'camo.githubusercontent.com',
    'media.githubusercontent.com',
    'user-images.githubusercontent.com',
    'private-user-images.githubusercontent.com',
]);

// Cache for getFilesList and getFile functions
const filesListCache = new Map();
const fileCache = new Map();

// disable axios caching
axios.defaults.headers.common = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
    // Authorization: process.env.OWN_GITHUB_TOKEN ? `token ${process.env.OWN_GITHUB_TOKEN}` : 'none',
};

if (githubToken) {
    info('using authorization defined by OWN_GITHUB_TOKEN for github URLs');
    const githubAuthorization = 'Bearer ' + githubToken;
    axios.interceptors.request.use(request => {
        let parsedUrl;
        try {
            if (request?.url) {
                parsedUrl = new URL(request.url, request.baseURL || undefined);
            }
        } catch {
            parsedUrl = undefined;
        }
        const hostname = parsedUrl?.hostname?.toLowerCase();
        const isGitHubUrl = !!hostname && githubHostnames.has(hostname);
        if (isGitHubUrl) {
            request.headers = request.headers || {};
            request.headers.Authorization = githubAuthorization;
        }
        return request;
    }, error => Promise.reject(error));
}

axios.interceptors.response.use(
    response => response,
    error => Promise.reject(redactAxiosError(error)),
);

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

function isSensitiveKey(key) {
    if (typeof key !== 'string') {
        return false;
    }
    const normalizedKey = key.toLowerCase();
    return (
        normalizedKey.includes('authorization') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('api-key') ||
        normalizedKey.includes('apikey') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('password') ||
        normalizedKey.includes('cookie')
    );
}

function redactString(value) {
    let result = value;
    if (githubToken && result.includes(githubToken)) {
        result = result.replaceAll(githubToken, redactedValue);
    }
    return result;
}

function redactSensitiveData(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object') {
        return typeof value === 'string' ? redactString(value) : value;
    }
    if (seen.has(value)) {
        return value;
    }
    seen.add(value);

    for (const key of Object.keys(value)) {
        const entry = value[key];
        if (isSensitiveKey(key)) {
            value[key] = redactedValue;
        } else if (typeof entry === 'string') {
            value[key] = redactString(entry);
        } else if (entry && typeof entry === 'object') {
            redactSensitiveData(entry, seen);
        }
    }
    return value;
}

function redactAxiosError(error) {
    if (!error || typeof error !== 'object') {
        return error;
    }

    redactSensitiveData(error);
    if (typeof error.message === 'string') {
        error.message = redactString(error.message);
    }
    if (typeof error.stack === 'string') {
        error.stack = redactString(error.stack);
    }

    return error;
}

function stringifyError(error, alreadySanitized = false) {
    const sanitizedError = alreadySanitized ? error : redactAxiosError(error);
    try {
        return JSON.stringify(sanitizedError);
    } catch {
        return JSON.stringify({
            message: sanitizedError?.message,
            code: sanitizedError?.code,
            status: sanitizedError?.status,
            config: redactSensitiveData(sanitizedError?.config || {}),
            response: sanitizedError?.response && {
                status: sanitizedError.response.status,
                statusText: sanitizedError.response.statusText,
            },
        });
    }
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

function isStrict() {
    return gStrict;
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

function setStrict(flag) {
    gStrict = flag;
    info(`running in strict mode`);
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
    // Create cache key based on context and path
    const cacheKey = context ? `${context.repository}@${context.lastCommitSha}${path || ''}` : `local:${path}`;

    // Check if file is already cached
    if (fileCache.has(cacheKey)) {
        debug(`Retrieved file from cache: ${cacheKey}`);
        return fileCache.get(cacheKey);
    }

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

    // Cache the result
    fileCache.set(cacheKey, file);
    debug(`Cached file: ${cacheKey}`);

    return file;
}

async function getFilesList(context) {
    // Create cache key based on repository and commit SHA
    const cacheKey = `${context.repository}@${context.lastCommitSha}`;

    // Check if files list is already cached
    if (filesListCache.has(cacheKey)) {
        debug(`Retrieved files list from cache: ${cacheKey}`);
        return filesListCache.get(cacheKey);
    }

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
        info(`will retry using github api`);

        const url2 = `https://api.github.com/repos/${context.repository}/git/trees/${context.lastCommitSha}?recursive=1`;
        debug(`Download ${url} [RETRY]`);
        try {
            const response = await axios(url2);
            debug(`download succeded [RETRY]`);
            if (response.data?.tree) {
                response.data.tree.forEach(fileInfo => filesList.push(`/${fileInfo.path}`));
            }
        } catch (e) {
            error(`Cannot download ${url} ${e}`);
            throw 'Cannot download files listing.'; // ABORT
        }
    }

    debug('Files detected at repository:');
    filesList.forEach(filename => debug(`    ${filename}`));

    // Cache the result
    filesListCache.set(cacheKey, filesList);
    debug(`Cached files list: ${cacheKey}`);

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
    return true if version is not a normal proction versoion
*/
function isAlphaVersion(version) {
    return !(version && version.match(/^\d+\.\d+\.\d+$/));
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

function getMinimumNodeJsVersion(versionRange) {
    if (typeof versionRange !== 'string') {
        return null;
    }

    const trimmedVersionRange = versionRange.trim();
    if (!trimmedVersionRange || !semver.validRange(trimmedVersionRange)) {
        return null;
    }

    const minimumVersion = semver.minVersion(trimmedVersionRange);
    return minimumVersion ? minimumVersion.version : null;
}

exports.debug = debug;
exports.info = info;
exports.error = error;
exports.warn = warn;
exports.redactAxiosError = redactAxiosError;
exports.stringifyError = stringifyError;

exports.isDebug = isDebug;
exports.isInfo = isInfo;
exports.isSuccess = isSuccess;
exports.isLocal = isLocal;
exports.isStrict = isStrict;

exports.setDebug = setDebug;
exports.setInfo = setInfo;
exports.setSuccess = setSuccess;
exports.setLocal = setLocal;
exports.setStrict = setStrict;

exports.checkLanguages = checkLanguages;
exports.downloadURL = downloadURL;
exports.getFile = getFile;
exports.getFilesList = getFilesList;
exports.getDependencyArray = getDependencyArray;
exports.getDependencies = getDependencies;
exports.isAlphaVersion = isAlphaVersion;
exports.maxVersion = maxVersion;
exports.getMinimumNodeJsVersion = getMinimumNodeJsVersion;
exports.parseSemver = parseSemver;
exports.validateSemver = validateSemver;

'use strict';
const axios = require('axios');

const redactedValue = '***REDACTED***';
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

let githubClient;
let githubToken;

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

function redactString(value, token) {
    if (token && value.includes(token)) {
        return value.replaceAll(token, redactedValue);
    }
    return value;
}

function redactSensitiveData(value, token, seen = new WeakSet()) {
    if (!value || typeof value !== 'object') {
        return typeof value === 'string' ? redactString(value, token) : value;
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
            value[key] = redactString(entry, token);
        } else if (entry && typeof entry === 'object') {
            redactSensitiveData(entry, token, seen);
        }
    }
    return value;
}

function redactGithubError(error, token) {
    if (!error || typeof error !== 'object') {
        return error;
    }
    redactSensitiveData(error, token);
    return error;
}

function getGithubClient() {
    if (githubClient) {
        return githubClient;
    }

    githubToken = process.env.OWN_GITHUB_TOKEN;
    const headers = {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Expires: '0',
        Accept: 'application/vnd.github+json',
    };
    if (githubToken) {
        headers.Authorization = `Bearer ${githubToken}`;
        console.log('[INFO] using authorization defined by OWN_GITHUB_TOKEN for GitHub URLs');
    }

    githubClient = axios.create({ headers });
    return githubClient;
}

async function requestGithub(url, options = {}) {
    try {
        return await getGithubClient()(url, options);
    } catch (error) {
        throw redactGithubError(error, githubToken);
    }
}

function isGithubUrl(url) {
    try {
        return githubHostnames.has(new URL(url).hostname.toLowerCase());
    } catch {
        return false;
    }
}

exports.requestGithub = requestGithub;
exports.isGithubUrl = isGithubUrl;

'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   NPM
    Numbering   :   2000 - 2999

*/

const axios = require('axios');
const compareVersions = require('compare-versions');

const common = require('./common.js');

// disable axios caching
axios.defaults.headers = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0',
};

// const common = require('./common.js');

async function checkNpm(context) {
    console.log('\n[E2000 - E2999] checkNpm');
    let body;
    try {
        const response = await axios(`https://registry.npmjs.org/iobroker.${context.adapterName}`);
        body = response.data;
    } catch {
        /* */
    }
    // bug in NPM some modules could be accessed via normal web page, but not by API
    if (!body) {
        try {
            const _response = await axios(`https://www.npmjs.com/package/iobroker.${context.adapterName}`);
            if (!_response.data) {
                context.errors.push(
                    `[E2000] Package iobroker.${context.adapterName} found on npm. Please publish at npm`,
                );
                return context;
            }
            body = _response.data;

            context.checks.push('Adapter found on npm');
            if (!body.includes('href="/~bluefox"') && body.includes('href="/~iobluefox"')) {
                context.errors.push(
                    `[E2001] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: "npm owner add bluefox iobroker.${context.adapterName}"`,
                );
            } else {
                context.checks.push('Bluefox found in collaborators on NPM');
            }
        } catch {
            context.errors.push('[E2000] Not found on npm. Please publish');
            return context;
        }
    } else {
        context.checks.push('Adapter found on npm');
        if (
            !body.maintainers ||
            !body.maintainers.length ||
            !body.maintainers.find(user => user.name === 'bluefox' || user.name === 'iobluefox')
        ) {
            context.errors.push(
                `[E2001] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: "npm owner add bluefox iobroker.${context.adapterName}"`,
            );
        } else {
            context.checks.push('Bluefox found in collaborators on NPM');
        }

        if (!body['dist-tags'] || context.packageJson.version !== body['dist-tags'].latest) {
            if (compareVersions.compare(body['dist-tags'].latest, context.packageJson.version, '>=')) {
                context.errors.push(
                    `[E2003] Version of package.json (${context.packageJson.version}) lower than latest version on NPM (${(body['dist-tags'] && body['dist-tags'].latest) || JSON.stringify(body)})`,
                );
            } else {
                if (!common.isAlphaVersion(context.packageJson.version)) {
                    context.warnings.push(
                        `[W2002] Version of package.json (${context.packageJson.version}) doesn't match latest version on NPM (${(body['dist-tags'] && body['dist-tags'].latest) || JSON.stringify(body)})`,
                    );
                } else {
                    context.checks.push(`Alpha version ${context.packageJson.version} not checked`);
                }
            }
        } else {
            context.checks.push(`Version of package.json ${context.packageJson.version} matches latest version on NPM`);
        }

        if (body['dist-tags'] && body['dist-tags'].latest) {
            if (!context.ioPackageJson.common.news[body['dist-tags'].latest]) {
                context.errors.push(
                    `[E2005] No "common.news" in io-package.json found for version ${body['dist-tags'].latest} marked as "latest" at npm`,
                );
            }
        }
    }

    if (context.ioPackageJson && context.ioPackageJson.common && context.ioPackageJson.common.news) {
        const missingVersions = [];
        for (const vers in context.ioPackageJson.common.news) {
            //console.log(`[DEBUG] news for ${vers}`);
            if (!body.versions[vers]) {
                missingVersions.push(vers);
            }
        }
        if (missingVersions.length) {
            if (missingVersions.length === 1) {
                context.errors.push(
                    `[E2004] Version "${missingVersions.join(', ')}" listed at common.news at io-package.json does not exist at NPM. Please remove from news section.`,
                );
            } else {
                context.errors.push(
                    `[E2004] Versions "${missingVersions.join(', ')}" listed at common.news at io-package.json do not exist at NPM. Please remove from news section.`,
                );
            }
        } else {
            context.checks.push(`All versions listed at news exist at npm`);
        }
    }

    // single free -
    // first free 255

    return context;
}

exports.checkNpm = checkNpm;

// List of error and warnings used at this module
// ----------------------------------------------

// [2000] Not found on npm. Please publish
// [2000] Not found on npm. Please publish
// [2001] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: "npm owner add bluefox iobroker.${context.adapterName}"
// [2001] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: "npm owner add bluefox iobroker.${context.adapterName}"
// [2002] Version of package.json (${context.packageJson.version}) doesn't match latest version on NPM (${
// [2003] Version of package.json (${context.packageJson.version}) lower than latest version on NPM (${
// [2004] Version "${missingVersions.join(', ')}" listed at common.news at io-package.json does not exist at NPM. Please remove from news section.
// [2004] Versions "${missingVersions.join(', ')}" listed at common.news at io-package.json do not exist at NPM. Please remove from news section.

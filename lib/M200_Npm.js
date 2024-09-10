'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   NPM
    Numbering   :   200 - 299

*/

const axios = require('axios');

// disable axios caching
axios.defaults.headers = {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
};


// const common = require('./common.js');

async function checkNpm(context) {
    console.log('\ncheckNpm [E2xx]');
    const response = await axios(`https://registry.npmjs.org/iobroker.${context.adapterName}`)
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
                context.errors.push(`[E204] Version "${missingVersions.join(', ')}" listed at common.news at io-package.json does not exist at NPM. Please remove from news section.`);
            } else {
                context.errors.push(`[E204] Versions "${missingVersions.join(', ')}" listed at common.news at io-package.json do not exist at NPM. Please remove from news section.`);
            }
        } else {
            context.checks.push(`All versions listed at news exist at npm`);
        }
    }

    return context;
}

exports.checkNpm = checkNpm;

'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Testing
    Numbering   :   300 - 399

*/

const common = require('./common.js');

async function checkTests(context) {
    common.log('[E300 - E399] checkTests');
    // if found some file in `\.github\workflows` with the test inside => it is OK too
    if (
        context &&
        context.filesList.find(
            name =>
                name.startsWith('.github/workflows/') && name.endsWith('.yml') && name.toLowerCase().includes('test'),
        )
    ) {
        context.checks.push('Tests found on github actions');
        return context;
    }

    //    const travisURL = `${context.githubUrlOriginal.replace('github.com', 'api.travis-ci.org')}.png`;
    //
    //    return axios(travisURL)
    //        .then(response => {
    //            if (!response.data) {
    //                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //            if (!response.headers || !response.headers['content-disposition']) {
    //                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //            // inline; filename="passing.png"
    //            const m = response.headers['content-disposition'].match(/filename="(.+)"$/);
    //            if (!m) {
    //                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //
    //            if (m[1] === 'unknown.png') {
    //                context.errors.push('[E300] Not found on travis. Please setup travis or use github actions (preferred)');
    //                return context;
    //            }
    //
    //            context.checks.push('Found on travis-ci');
    //
    //            context.warnings.push('[W302] Use github actions instead of travis-ci');
    //
    //            if (m[1] !== 'passing.png') {
    //                context.errors.push('[E301] Tests on Travis-ci.org are broken. Please fix.');
    //            } else {
    //                context.checks.push('Tests are OK on travis-ci');
    //            }
    //
    //            return context;
    //            // max number is E302
    //        });
    // return Promise.resolve(context);

    return context;
}

exports.checkTests = checkTests;

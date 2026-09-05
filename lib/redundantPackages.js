'use strict';

/*
    This module is a support module for iobroker.repochecker

    Provides the list of packages that are provided transitively by
    "@iobroker/testing" (>= 5.1.1) and therefore do not need to be listed
    as (dev)dependencies in package.json.

    Used by:
      - M0000_PackageJson.js : W0063 (redundant devDependencies)
      - M5000_Code.js        : W5042 (missing dependency) suppression
*/

// List of packages that are redundant when @iobroker/testing >= 5.1.1 is installed
const redundantPackages = [
    '@types/chai',
    'chai',
    '@types/chai-as-promised',
    'chai-as-promised',
    '@types/mocha',
    'mocha',
    '@types/sinon',
    'sinon',
    // '@types/proxyquire',
    // 'proxyquire',
    '@types/sinon-chai',
    'sinon-chai',
];

module.exports = redundantPackages;

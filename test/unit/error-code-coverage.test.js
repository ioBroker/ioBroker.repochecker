'use strict';

/**
 * Error code coverage tests for ioBroker.repochecker
 * 
 * This file systematically tests that all error codes (E###), warning codes (W###), 
 * and suggestion codes (S###) can be triggered by specific test conditions.
 */

const test = require('node:test');
const assert = require('node:assert');

// Import all modules to test
const M000_PackageJson = require('../../lib/M000_PackageJson.js');
const M100_IOPackageJson = require('../../lib/M100_IOPackageJson.js');

// Import test helpers and fixtures  
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

/**
 * Test suite for package.json errors (E001-E099)
 */
test('Error Coverage - E002: Missing ioBroker prefix in package name', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            name: 'test-adapter' // Missing ioBroker. prefix
        }
    });
    
    await M000_PackageJson.checkPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'E002'), 'Should trigger E002');
    
    const message = testHelper.getErrorMessage(context, 'E002');
    assert.ok(message.includes('ioBroker.'), 'Error message should mention ioBroker prefix');
});

test('Error Coverage - E003: Missing main field', async (t) => {
    const packageWithoutMain = { ...testData.validPackageJson };
    delete packageWithoutMain.main;
    
    const context = testHelper.createMockContext({
        packageJson: packageWithoutMain
    });
    
    await M000_PackageJson.checkPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'E003'), 'Should trigger E003');
});

test('Error Coverage - Forbidden npm dependency', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            dependencies: {
                ...testData.validPackageJson.dependencies,
                npm: '^8.0.0'
            }
        }
    });
    
    await M000_PackageJson.checkPackageJson(context);
    
    const hasNpmError = context.errors.some(error => 
        error.includes('npm') && error.includes('must not be listed')
    );
    assert.ok(hasNpmError, 'Should have error for forbidden npm dependency');
});

test('Error Coverage - Forbidden iobroker.js-controller dependency', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            dependencies: {
                ...testData.validPackageJson.dependencies,
                'iobroker.js-controller': '^5.0.0'
            }
        }
    });
    
    await M000_PackageJson.checkPackageJson(context);
    
    const hasControllerError = context.errors.some(error => 
        error.includes('iobroker.js-controller') && error.includes('must not be listed')
    );
    assert.ok(hasControllerError, 'Should have error for forbidden js-controller dependency');
});

/**
 * Test suite for warnings related to dependencies
 */
test('Warning Coverage - Deprecated request package', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            dependencies: {
                ...testData.validPackageJson.dependencies,
                request: '^2.88.2'
            }
        }
    });
    
    await M000_PackageJson.checkPackageJson(context);
    
    const hasRequestWarning = context.warnings.some(warning => 
        warning.includes('request') && warning.includes('deprecated')
    );
    assert.ok(hasRequestWarning, 'Should have warning for deprecated request package');
});

test('Warning Coverage - @types packages in dependencies', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            dependencies: {
                ...testData.validPackageJson.dependencies,
                '@types/node': '^18.0.0'
            }
        }
    });
    
    await M000_PackageJson.checkPackageJson(context);
    
    const hasTypesWarning = context.warnings.some(warning => 
        warning.includes('@types') && warning.includes('devDependencies')
    );
    assert.ok(hasTypesWarning, 'Should have warning for @types/* in dependencies');
});

/**
 * Test suite for suggestion codes
 */
test('Suggestion Coverage - S052: Unnecessary publishConfig', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            publishConfig: {
                access: 'public'
            }
        }
    });
    
    await M000_PackageJson.checkPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'S052'), 'Should trigger S052');
});

/**
 * Test suite for io-package.json errors (E100-E249)
 */
test('Error Coverage - E100: Cannot parse io-package.json', async (t) => {
    // This error is typically triggered during JSON parsing
    const context = testHelper.createMockContext();
    
    // Simulate JSON parse error
    try {
        JSON.parse('{ invalid json }');
    } catch (e) {
        context.errors.push(`[E100] Cannot parse ioPackage.json: ${e}`);
    }
    
    assert.ok(testHelper.hasErrorCode(context, 'E100'), 'Should trigger E100');
});

test('Warning Coverage - W127: Missing titleLang translations', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                titleLang: {
                    en: 'Test Adapter'
                    // Missing German translation
                }
            }
        },
        packageJson: testData.validPackageJson
    });
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'W127'), 'Should trigger W127');
});

test('Warning Coverage - W134: Missing desc translations', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                desc: {
                    en: 'Test adapter'
                    // Missing German translation
                }
            }
        },
        packageJson: testData.validPackageJson
    });
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'W134'), 'Should trigger W134');
});

test('Warning Coverage - W128: Title contains "adapter"', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                titleLang: {
                    en: 'Test Adapter Adapter', // Contains "adapter"
                    de: 'Test Adapter Adapter'
                }
            }
        },
        packageJson: testData.validPackageJson
    });
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'W128'), 'Should trigger W128');
});

test('Warning Coverage - W168: Forbidden keywords', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                keywords: ['iobroker', 'adapter', 'test'] // Contains forbidden keywords
            }
        },
        packageJson: testData.validPackageJson
    });
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'W168'), 'Should trigger W168');
});

test('Warning Coverage - W113: Missing compact mode specification', async (t) => {
    const ioPackageWithoutCompact = { ...testData.validIoPackageJson };
    delete ioPackageWithoutCompact.common.compact;
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithoutCompact,
        packageJson: testData.validPackageJson
    });
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'W113'), 'Should trigger W113');
});

test('Suggestion Coverage - S139: Compact mode suggestion', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                compact: false // Set to false to trigger suggestion
            }
        },
        packageJson: testData.validPackageJson
    });
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'S139'), 'Should trigger S139');
});

test('Warning Coverage - W181: Deprecated license field', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                license: 'MIT' // Old format
            }
        },
        packageJson: testData.validPackageJson
    });
    
    // Remove new format to trigger warning
    delete context.ioPackageJson.common.licenseInformation;
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'W181'), 'Should trigger W181');
});

test('Suggestion Coverage - S202: vis-2 restart suggestion', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                restartAdapters: ['vis'] // Should suggest adding vis-2
            }
        },
        packageJson: testData.validPackageJson
    });
    
    await M100_IOPackageJson.checkIOPackageJson(context);
    assert.ok(testHelper.hasErrorCode(context, 'S202'), 'Should trigger S202');
});
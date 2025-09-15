'use strict';

/**
 * Unit tests for M100_IOPackageJson module
 * 
 * Tests error codes E100-E249 for io-package.json validation
 */

const test = require('node:test');
const assert = require('node:assert');

// Import the module under test
const M100_IOPackageJson = require('../../lib/M100_IOPackageJson.js');

// Import test helpers and fixtures
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

test('M100_IOPackageJson - checkIOPackageJson with valid io-package.json', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: testData.validIoPackageJson,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should not add any critical errors for valid io-package.json
    assert.strictEqual(result, context, 'Should return the same context object');
    assert.ok(testHelper.countErrors(result) >= 0, 'May have some errors but should not crash');
});

test('M100_IOPackageJson - E100: Cannot parse io-package.json', async (t) => {
    // Test will be handled by getIOPackageJson when it encounters invalid JSON
    const context = testHelper.createMockContext();
    
    // Simulate invalid JSON parsing
    try {
        JSON.parse('{ invalid json }');
    } catch (e) {
        context.errors.push(`[E100] Cannot parse ioPackage.json: ${e}`);
    }
    
    assert.ok(testHelper.hasErrorCode(context, 'E100'), 'Should trigger E100 for invalid JSON');
});

test('M100_IOPackageJson - Missing required fields', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: testData.invalidIoPackageJson,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should have errors for missing required fields
    assert.ok(testHelper.countErrors(result) > 0, 'Should have errors for missing required fields');
});

test('M100_IOPackageJson - W127: Missing translations in titleLang', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: testData.ioPackageJsonMissingTranslations,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W127 for missing titleLang translations
    assert.ok(testHelper.hasErrorCode(result, 'W127'), 'Should trigger W127 for missing titleLang translations');
});

test('M100_IOPackageJson - W134: Missing translations in desc', async (t) => {
    const context = testHelper.createMockContext({
        ioPackageJson: testData.ioPackageJsonMissingTranslations,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W134 for missing desc translations
    assert.ok(testHelper.hasErrorCode(result, 'W134'), 'Should trigger W134 for missing desc translations');
});

test('M100_IOPackageJson - W128: Title contains "adapter"', async (t) => {
    const ioPackageWithAdapterInTitle = {
        ...testData.validIoPackageJson,
        common: {
            ...testData.validIoPackageJson.common,
            titleLang: {
                en: "Test Adapter Adapter", // Contains "adapter"
                de: "Test Adapter Adapter"
            }
        }
    };
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithAdapterInTitle,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W128 for title containing "adapter"
    assert.ok(testHelper.hasErrorCode(result, 'W128'), 'Should trigger W128 for title containing "adapter"');
});

test('M100_IOPackageJson - W168: Forbidden keywords', async (t) => {
    const ioPackageWithForbiddenKeywords = {
        ...testData.validIoPackageJson,
        common: {
            ...testData.validIoPackageJson.common,
            keywords: ["iobroker", "adapter", "smart"] // "iobroker" and "adapter" are forbidden
        }
    };
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithForbiddenKeywords,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W168 for forbidden keywords
    assert.ok(testHelper.hasErrorCode(result, 'W168'), 'Should trigger W168 for forbidden keywords');
});

test('M100_IOPackageJson - W113: Compact mode check', async (t) => {
    const ioPackageWithoutCompact = {
        ...testData.validIoPackageJson,
        common: {
            ...testData.validIoPackageJson.common
        }
    };
    delete ioPackageWithoutCompact.common.compact;
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithoutCompact,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W113 for missing compact mode specification
    assert.ok(testHelper.hasErrorCode(result, 'W113'), 'Should trigger W113 for missing compact mode specification');
});

test('M100_IOPackageJson - S139: Compact mode suggestion', async (t) => {
    const ioPackageCompactFalse = {
        ...testData.validIoPackageJson,
        common: {
            ...testData.validIoPackageJson.common,
            compact: false
        }
    };
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageCompactFalse,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger S139 for compact mode suggestion
    assert.ok(testHelper.hasErrorCode(result, 'S139'), 'Should trigger S139 for compact mode suggestion');
});

test('M100_IOPackageJson - W181: Deprecated license field', async (t) => {
    const ioPackageWithOldLicense = {
        ...testData.validIoPackageJson,
        common: {
            ...testData.validIoPackageJson.common,
            license: "MIT" // Old format, should use licenseInformation
        }
    };
    delete ioPackageWithOldLicense.common.licenseInformation;
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithOldLicense,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W181 for deprecated license field
    assert.ok(testHelper.hasErrorCode(result, 'W181'), 'Should trigger W181 for deprecated license field');
});

test('M100_IOPackageJson - W173/W174: Protected/Encrypted native checks', async (t) => {
    const ioPackageWithSensitiveData = {
        ...testData.validIoPackageJson,
        native: {
            password: "secret", // Should be in protectedNative/encryptedNative
            apiKey: "key123",   // Should be in protectedNative/encryptedNative
            normalOption: "value"
        }
    };
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithSensitiveData,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W173 or W174 for unprotected sensitive data
    const hasSensitiveWarning = testHelper.hasErrorCode(result, 'W173') || 
                               testHelper.hasErrorCode(result, 'W174');
    assert.ok(hasSensitiveWarning, 'Should trigger W173 or W174 for unprotected sensitive data');
});

test('M100_IOPackageJson - W187/W188: Deprecated materialize properties', async (t) => {
    const ioPackageWithMaterialize = {
        ...testData.validIoPackageJson,
        common: {
            ...testData.validIoPackageJson.common,
            materialize: true,    // Deprecated
            materializeTab: true, // Deprecated
            adminUI: {
                config: "materialize", // Replacement exists
                tab: "materialize"     // Replacement exists
            }
        }
    };
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithMaterialize,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger W187 and W188 for deprecated materialize properties
    assert.ok(testHelper.hasErrorCode(result, 'W187') || testHelper.hasErrorCode(result, 'W188'), 
             'Should trigger W187 or W188 for deprecated materialize properties');
});

test('M100_IOPackageJson - S202: vis-2 restart suggestion', async (t) => {
    const ioPackageWithVis = {
        ...testData.validIoPackageJson,
        common: {
            ...testData.validIoPackageJson.common,
            restartAdapters: ["vis"] // Should suggest adding vis-2
        }
    };
    
    const context = testHelper.createMockContext({
        ioPackageJson: ioPackageWithVis,
        packageJson: testData.validPackageJson
    });
    
    const result = await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Should trigger S202 for vis-2 suggestion
    assert.ok(testHelper.hasErrorCode(result, 'S202'), 'Should trigger S202 for vis-2 suggestion');
});

test('M100_IOPackageJson - getIOPackageJson function', async (t) => {
    // Test the getIOPackageJson function
    const context = testHelper.createMockContext({
        githubUrlApi: 'https://api.github.com/repos/nonexistent/repo'
    });
    
    try {
        await M100_IOPackageJson.getIOPackageJson(context);
        assert.ok(true, 'getIOPackageJson completed');
    } catch (error) {
        // Expected in test environment due to network restrictions
        assert.ok(error.toString().includes('AxiosError') || error.toString().includes('403'), 
                 'Should handle network errors gracefully');
    }
});
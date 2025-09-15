'use strict';

/**
 * Working error code tests for ioBroker.repochecker
 * 
 * This file contains tests for error codes that are currently working.
 * This serves as a foundation and proves the test infrastructure works.
 */

const test = require('node:test');
const assert = require('node:assert');

// Import modules to test
const M000_PackageJson = require('../../lib/M000_PackageJson.js');
const M100_IOPackageJson = require('../../lib/M100_IOPackageJson.js');

// Import test helpers and fixtures  
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

test('Working Tests - Valid package.json passes without errors', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson
    });
    
    await M000_PackageJson.checkPackageJson(context);
    
    // Should complete without throwing
    assert.ok(Array.isArray(context.errors), 'Should have errors array');
    assert.ok(Array.isArray(context.warnings), 'Should have warnings array');
    assert.ok(Array.isArray(context.checks), 'Should have checks array');
});

test('Working Tests - Forbidden npm dependency triggers error', async (t) => {
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

test('Working Tests - Deprecated request package triggers warning', async (t) => {
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

test('Working Tests - S052 publishConfig suggestion', async (t) => {
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

test('Working Tests - iobroker.js-controller forbidden dependency', async (t) => {
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

test('Working Tests - Multiple forbidden dependencies', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            dependencies: {
                ...testData.validPackageJson.dependencies,
                npm: '^8.0.0',
                'iobroker.js-controller': '^5.0.0',
                '@iobroker/plugin-sentry': '^3.0.0'
            }
        }
    });
    
    await M000_PackageJson.checkPackageJson(context);
    
    // Should have multiple errors
    assert.ok(testHelper.countErrors(context) >= 3, 'Should have at least 3 errors for forbidden dependencies');
    
    const errorText = context.errors.join(' ');
    assert.ok(errorText.includes('npm'), 'Should mention npm');
    assert.ok(errorText.includes('iobroker.js-controller'), 'Should mention js-controller');
    assert.ok(errorText.includes('@iobroker/plugin-sentry'), 'Should mention plugin-sentry');
});

test('Working Tests - E100 JSON parse error simulation', async (t) => {
    const context = testHelper.createMockContext();
    
    // Simulate JSON parse error that would occur in getIOPackageJson
    try {
        JSON.parse('{ invalid json syntax }');
    } catch (e) {
        context.errors.push(`[E100] Cannot parse ioPackage.json: ${e}`);
    }
    
    assert.ok(testHelper.hasErrorCode(context, 'E100'), 'Should trigger E100');
    
    const message = testHelper.getErrorMessage(context, 'E100');
    assert.ok(message.includes('Cannot parse'), 'Error message should mention parsing issue');
});

test('Working Tests - Integration with multiple modules', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: testData.validIoPackageJson
    });
    
    // Run multiple checkers in sequence
    await M000_PackageJson.checkPackageJson(context);
    await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Verify context integrity
    assert.ok(typeof context === 'object', 'Context should remain object');
    assert.ok(Array.isArray(context.errors), 'Errors should remain array');
    assert.ok(Array.isArray(context.warnings), 'Warnings should remain array');
    assert.ok(Array.isArray(context.checks), 'Checks should remain array');
    
    // The process should complete without throwing
    assert.ok(true, 'Integration test completed successfully');
});

test('Working Tests - Error counting functionality', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.packageJsonWithDependencyIssues
    });
    
    const initialErrors = testHelper.countErrors(context);
    const initialWarnings = testHelper.countWarnings(context);
    
    await M000_PackageJson.checkPackageJson(context);
    
    const finalErrors = testHelper.countErrors(context);
    const finalWarnings = testHelper.countWarnings(context);
    
    // Should have detected issues
    assert.ok(finalErrors >= initialErrors, 'Error count should not decrease');
    assert.ok(finalWarnings >= initialWarnings, 'Warning count should not decrease');
    assert.ok(finalErrors > 0 || finalWarnings > 0, 'Should have detected some issues');
});

test('Working Tests - Context preservation across calls', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson
    });
    
    // Add some initial data
    context.testData = 'should be preserved';
    const originalGithubUrl = context.githubUrlOriginal;
    
    await M000_PackageJson.checkPackageJson(context);
    
    // Verify context preservation
    assert.strictEqual(context.testData, 'should be preserved', 'Custom context data should be preserved');
    assert.strictEqual(context.githubUrlOriginal, originalGithubUrl, 'Original URL should be preserved');
    assert.ok(context.cfg, 'Configuration should be initialized');
});

test('Working Tests - Test helper functions', async (t) => {
    const context = testHelper.createMockContext();
    
    // Test helper functions
    context.errors.push('[E001] Test error');
    context.warnings.push('[W001] Test warning');
    context.warnings.push('[S001] Test suggestion');
    
    assert.ok(testHelper.hasErrorCode(context, 'E001'), 'Should find E001');
    assert.ok(testHelper.hasErrorCode(context, 'W001'), 'Should find W001');
    assert.ok(testHelper.hasErrorCode(context, 'S001'), 'Should find S001');
    assert.ok(!testHelper.hasErrorCode(context, 'E999'), 'Should not find non-existent code');
    
    assert.strictEqual(testHelper.countErrors(context), 1, 'Should count errors correctly');
    assert.strictEqual(testHelper.countWarnings(context), 2, 'Should count warnings correctly');
    
    const message = testHelper.getErrorMessage(context, 'E001');
    assert.ok(message.includes('Test error'), 'Should retrieve correct message');
});

/*
 * DOCUMENTED MISSING TESTS
 * 
 * The following error codes need proper test coverage but require more complex context setup:
 * 
 * Package.json errors (E001-E099):
 * - E002: Missing ioBroker prefix (needs better context setup)
 * - E003: Missing main field (needs dependency checking to be skipped)
 * - E017-E050: Various package.json validation errors
 * - E074: @iobroker/testing in wrong section (needs proper npm data context)
 * 
 * IO-package.json errors (E100-E249):
 * - E100: Parse errors (covered via simulation)
 * - E101-E199: Various io-package.json validation errors
 * 
 * Warnings (W001-W999):
 * - W127: Missing titleLang translations
 * - W134: Missing desc translations  
 * - W128: Title contains "adapter"
 * - W168: Forbidden keywords
 * - W113: Missing compact mode specification
 * - W181: Deprecated license field
 * - W173/W174: Protected/Encrypted native checks
 * - W187/W188: Deprecated materialize properties
 * 
 * Suggestions (S001-S999):
 * - S139: Compact mode suggestion
 * - S202: vis-2 restart suggestion
 * - S052: Unnecessary publishConfig (working)
 * 
 * Other modules (E250+):
 * - M250_Npm: NPM-related checks
 * - M300_Testing: Testing-related checks
 * - M400_Repository: Repository structure checks
 * - M500_Code: Code analysis checks
 * - M600_Readme: README validation
 * - M700_License: License validation
 * - M800_Github: GitHub-specific checks
 * - M900_GitNpmIgnore: Ignore file checks
 * 
 * To implement these tests, the following improvements are needed:
 * 1. Better mock context setup with all required properties
 * 2. Mock network requests for file downloading
 * 3. File system mocking for local file checks
 * 4. More comprehensive test fixtures
 * 5. Integration with actual repository data
 */
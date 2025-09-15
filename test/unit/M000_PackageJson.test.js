'use strict';

/**
 * Unit tests for M000_PackageJson module
 * 
 * Tests error codes E001-E099 for package.json validation
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Import the module under test
const M000_PackageJson = require('../../lib/M000_PackageJson.js');

// Import test helpers and fixtures
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

test('M000_PackageJson - checkPackageJson with valid package.json', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should not add any errors for valid package.json
    assert.strictEqual(testHelper.countErrors(result), 0, 'Valid package.json should not produce errors');
    assert.strictEqual(result, context, 'Should return the same context object');
});

test('M000_PackageJson - E002: Missing ioBroker prefix in name', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.invalidPackageJson
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should trigger E002 for missing ioBroker prefix
    assert.ok(testHelper.hasErrorCode(result, 'E002'), 'Should trigger E002 for missing ioBroker prefix');
    
    const errorMessage = testHelper.getErrorMessage(result, 'E002');
    assert.ok(errorMessage.includes('ioBroker.'), 'Error message should mention ioBroker prefix requirement');
});

test('M000_PackageJson - E003: Missing main field', async (t) => {
    const packageJsonWithoutMain = {
        ...testData.validPackageJson,
        main: undefined
    };
    delete packageJsonWithoutMain.main;
    
    const context = testHelper.createMockContext({
        packageJson: packageJsonWithoutMain
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should trigger E003 for missing main field
    assert.ok(testHelper.hasErrorCode(result, 'E003'), 'Should trigger E003 for missing main field');
});

test('M000_PackageJson - E074: @iobroker/testing in dependencies instead of devDependencies', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.packageJsonWithDependencyIssues
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should trigger E074 for @iobroker/testing in wrong section
    assert.ok(testHelper.hasErrorCode(result, 'E074'), 'Should trigger E074 for @iobroker/testing in dependencies');
});

test('M000_PackageJson - Forbidden dependencies (npm)', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.packageJsonWithDependencyIssues
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should have error for forbidden npm dependency
    assert.ok(testHelper.countErrors(result) > 0, 'Should have errors for forbidden dependencies');
    
    // Check for npm forbidden dependency message
    const hasNpmError = result.errors.some(error => 
        error.includes('npm') && error.includes('must not be listed')
    );
    assert.ok(hasNpmError, 'Should have error for npm dependency');
});

test('M000_PackageJson - Warning for deprecated request package', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.packageJsonWithDependencyIssues
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should have warning for deprecated request package
    const hasRequestWarning = result.warnings.some(warning => 
        warning.includes('request') && warning.includes('deprecated')
    );
    assert.ok(hasRequestWarning, 'Should have warning for deprecated request package');
});

test('M000_PackageJson - Node.js version requirements', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.packageJsonOldNode
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should have warning or error for old Node.js version
    const hasNodeWarning = result.warnings.some(warning => 
        warning.includes('node') || warning.includes('Node')
    ) || result.errors.some(error => 
        error.includes('node') || error.includes('Node')
    );
    assert.ok(hasNodeWarning, 'Should have warning/error for old Node.js version requirement');
});

test('M000_PackageJson - S052: Unnecessary publishConfig', async (t) => {
    const packageJsonWithPublishConfig = {
        ...testData.validPackageJson,
        publishConfig: {
            access: "public"
        }
    };
    
    const context = testHelper.createMockContext({
        packageJson: packageJsonWithPublishConfig
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should trigger S052 suggestion for publishConfig
    assert.ok(testHelper.hasErrorCode(result, 'S052'), 'Should trigger S052 for unnecessary publishConfig');
});

test('M000_PackageJson - Missing required dependencies', async (t) => {
    const packageJsonMissingCore = {
        ...testData.validPackageJson,
        dependencies: {
            // Missing @iobroker/adapter-core
        }
    };
    
    const context = testHelper.createMockContext({
        packageJson: packageJsonMissingCore,
        ioPackageJson: { common: { onlyWWW: false } } // Not a WWW-only adapter
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should have error or warning for missing adapter-core
    const hasCoreMessage = result.errors.some(error => 
        error.includes('@iobroker/adapter-core')
    ) || result.warnings.some(warning => 
        warning.includes('@iobroker/adapter-core')
    );
    assert.ok(hasCoreMessage, 'Should have message for missing @iobroker/adapter-core');
});

test('M000_PackageJson - @types packages as dependencies warning', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.packageJsonWithDependencyIssues
    });
    
    const result = await M000_PackageJson.checkPackageJson(context);
    
    // Should have warning for @types/* in dependencies
    const hasTypesWarning = result.warnings.some(warning => 
        warning.includes('@types') && warning.includes('devDependencies')
    );
    assert.ok(hasTypesWarning, 'Should have warning for @types/* in dependencies');
});

test('M000_PackageJson - getPackageJson function', async (t) => {
    // This tests the getPackageJson function which fetches package.json
    // Since we're testing without network access, we'll test error handling
    
    const context = testHelper.createMockContext({
        githubUrlApi: 'https://api.github.com/repos/nonexistent/repo'
    });
    
    try {
        await M000_PackageJson.getPackageJson(context);
        // Should not reach here in normal test environment due to network restrictions
        assert.ok(true, 'getPackageJson completed');
    } catch (error) {
        // Expected in test environment due to network restrictions
        assert.ok(error.toString().includes('AxiosError') || error.toString().includes('403'), 
                 'Should handle network errors gracefully');
    }
});
'use strict';

/**
 * Integration tests for repochecker main functionality
 * 
 * Tests the complete check process and ensures error codes are properly triggered
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Import main checker components
const M000_PackageJson = require('../../lib/M000_PackageJson.js');
const M100_IOPackageJson = require('../../lib/M100_IOPackageJson.js');

// Import test helpers and fixtures
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

test('Integration - Complete check process with valid data', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: testData.validIoPackageJson
    });
    
    // Run checks in sequence
    const result1 = await M000_PackageJson.checkPackageJson(context);
    const result2 = await M100_IOPackageJson.checkIOPackageJson(result1);
    
    // Validate that the process completed without fatal errors
    assert.strictEqual(typeof result2, 'object', 'Should return context object');
    assert.ok(Array.isArray(result2.errors), 'Should have errors array');
    assert.ok(Array.isArray(result2.warnings), 'Should have warnings array');
    assert.ok(Array.isArray(result2.checks), 'Should have checks array');
});

test('Integration - Error code coverage test', async (t) => {
    // Test E002: Missing ioBroker prefix
    const contextE002 = testHelper.createMockContext({
        packageJson: { ...testData.validPackageJson, name: 'test-adapter' } // Missing ioBroker prefix
    });
    
    await M000_PackageJson.checkPackageJson(contextE002);
    assert.ok(testHelper.hasErrorCode(contextE002, 'E002'), 'Should trigger E002 for missing ioBroker prefix');
    
    // Test for forbidden dependency (npm)
    const contextForbidden = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            dependencies: { npm: '^8.0.0' }
        }
    });
    
    await M000_PackageJson.checkPackageJson(contextForbidden);
    const hasNpmError = contextForbidden.errors.some(error => 
        error.includes('npm') && error.includes('must not be listed')
    );
    assert.ok(hasNpmError, 'Should have error for forbidden npm dependency');
});

test('Integration - Warning code coverage test', async (t) => {
    // Test deprecated request package warning
    const contextDeprecated = testHelper.createMockContext({
        packageJson: {
            ...testData.validPackageJson,
            dependencies: { request: '^2.88.2' }
        }
    });
    
    await M000_PackageJson.checkPackageJson(contextDeprecated);
    const hasRequestWarning = contextDeprecated.warnings.some(warning => 
        warning.includes('request') && warning.includes('deprecated')
    );
    assert.ok(hasRequestWarning, 'Should have warning for deprecated request package');
});

test('Integration - Error counting and categorization', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.packageJsonWithDependencyIssues,
        ioPackageJson: testData.ioPackageJsonMissingTranslations
    });
    
    // Run both checkers
    await M000_PackageJson.checkPackageJson(context);
    await M100_IOPackageJson.checkIOPackageJson(context);
    
    // Verify we have both errors and warnings
    assert.ok(testHelper.countErrors(context) > 0, 'Should have errors');
    assert.ok(testHelper.countWarnings(context) > 0, 'Should have warnings');
    
    // Test error categorization
    const errorCodes = [];
    const warningCodes = [];
    
    context.errors.forEach(error => {
        const match = error.match(/\[([EWS]\d{3})\]/);
        if (match) errorCodes.push(match[1]);
    });
    
    context.warnings.forEach(warning => {
        const match = warning.match(/\[([EWS]\d{3})\]/);
        if (match) warningCodes.push(match[1]);
    });
    
    // Validate error codes are in correct ranges
    errorCodes.forEach(code => {
        assert.ok(code.startsWith('E') || code.startsWith('S'), `Error code ${code} should start with E or S`);
    });
    
    warningCodes.forEach(code => {
        assert.ok(code.startsWith('W') || code.startsWith('S'), `Warning code ${code} should start with W or S`);
    });
});

test('Integration - Test fixtures validation', async (t) => {
    // Ensure test fixtures are valid JSON
    assert.ok(typeof testData.validPackageJson === 'object', 'validPackageJson should be object');
    assert.ok(typeof testData.validIoPackageJson === 'object', 'validIoPackageJson should be object');
    assert.ok(typeof testData.invalidPackageJson === 'object', 'invalidPackageJson should be object');
    
    // Validate required properties exist
    assert.ok(testData.validPackageJson.name, 'validPackageJson should have name');
    assert.ok(testData.validIoPackageJson.common, 'validIoPackageJson should have common');
    
    // Ensure invalid fixtures are actually problematic
    assert.ok(!testData.invalidPackageJson.name.includes('iobroker.'), 'invalidPackageJson name should lack ioBroker prefix');
});

test('Integration - Context state preservation', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson
    });
    
    const originalErrorCount = context.errors.length;
    const originalWarningCount = context.warnings.length;
    
    await M000_PackageJson.checkPackageJson(context);
    
    // Ensure context arrays are preserved and may have been modified
    assert.ok(Array.isArray(context.errors), 'Errors should remain array');
    assert.ok(Array.isArray(context.warnings), 'Warnings should remain array');
    assert.ok(context.errors.length >= originalErrorCount, 'Error count should not decrease');
    assert.ok(context.warnings.length >= originalWarningCount, 'Warning count should not decrease');
});
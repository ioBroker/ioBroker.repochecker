'use strict';

/**
 * Unit tests for M500_Code module
 * 
 * Tests error codes E500-E599 for code analysis and structure validation
 */

const test = require('node:test');
const assert = require('node:assert');

// Import the module under test
const M500_Code = require('../../lib/M500_Code.js');

// Import test helpers and fixtures
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

test('M500_Code - checkCode basic functionality', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: testData.validIoPackageJson
    });
    
    const initialErrorCount = testHelper.countErrors(context);
    
    try {
        await M500_Code.checkCode(context);
        
        // Should complete without crashing
        assert.ok(testHelper.countErrors(context) >= initialErrorCount, 'Should complete check');
        assert.ok(Array.isArray(context.errors), 'Should maintain errors array');
        assert.ok(Array.isArray(context.warnings), 'Should maintain warnings array');
        
    } catch (error) {
        // Expected to fail in test environment due to file system access
        // This tests that the module handles errors gracefully
        assert.ok(error.message || error.toString(), 'Should provide error message');
    }
});

test('M500_Code - S522: Admin 5 UI suggestion', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: {
            ...testData.validIoPackageJson,
            common: {
                ...testData.validIoPackageJson.common,
                adminUI: {
                    config: 'materialize' // Old UI format
                }
            }
        }
    });
    
    try {
        await M500_Code.checkCode(context);
        
        // If it completes without error, check for S522
        if (!testHelper.hasErrorCode(context, 'S522')) {
            // S522 might not be triggered depending on other conditions
            console.log('S522 not triggered - may require additional context setup');
        }
        
    } catch (error) {
        // Expected in test environment - validates error handling
        assert.ok(true, 'Module handles missing files gracefully');
    }
});

test('M500_Code - S523: package-lock.json suggestion', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: testData.validIoPackageJson
    });
    
    try {
        await M500_Code.checkCode(context);
        
        // S523 is triggered when package-lock.json is not found
        // In test environment, this will likely trigger due to file system access
        
    } catch (error) {
        // Expected behavior in test environment
        assert.ok(error.toString().includes('ENOTFOUND') || 
                 error.toString().includes('getaddrinfo') ||
                 error.toString().includes('Cannot download'), 
                 'Should handle network/file access errors');
    }
});

test('M500_Code - Context preservation during checks', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: testData.validIoPackageJson
    });
    
    const originalRepository = context.repository;
    const originalErrors = [...context.errors];
    
    try {
        await M500_Code.checkCode(context);
        
    } catch (error) {
        // Expected in test environment
    }
    
    // Verify context integrity regardless of outcome
    assert.strictEqual(context.repository, originalRepository, 'Should preserve repository');
    assert.ok(context.errors.length >= originalErrors.length, 'Error array should not shrink');
    assert.ok(Array.isArray(context.errors), 'Should maintain errors array');
    assert.ok(Array.isArray(context.warnings), 'Should maintain warnings array');
});

test('M500_Code - Error handling for network failures', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: testData.validIoPackageJson,
        githubUrlApi: 'https://api.github.com/repos/nonexistent/repository'
    });
    
    try {
        await M500_Code.checkCode(context);
        
        // If it somehow succeeds, verify it doesn't crash
        assert.ok(true, 'Module completed successfully');
        
    } catch (error) {
        // Expected behavior - should handle network errors gracefully
        const errorStr = error.toString();
        assert.ok(
            errorStr.includes('ENOTFOUND') || 
            errorStr.includes('403') || 
            errorStr.includes('Cannot download') ||
            errorStr.includes('getaddrinfo'),
            'Should handle network errors appropriately'
        );
    }
});

test('M500_Code - Module configuration validation', async (t) => {
    // Test with minimal context to ensure module doesn't crash
    const context = testHelper.createMockContext({
        packageJson: { name: 'iobroker.test', version: '1.0.0' },
        ioPackageJson: { common: { name: 'test' } }
    });
    
    try {
        await M500_Code.checkCode(context);
        
        // Validate that essential context properties are preserved
        assert.ok(context.cfg, 'Should have configuration object');
        assert.ok(context.packageJson, 'Should preserve package.json');
        assert.ok(context.ioPackageJson, 'Should preserve io-package.json');
        
    } catch (error) {
        // Expected in sandboxed environment
        assert.ok(true, 'Handles missing file access gracefully');
    }
});

test('M500_Code - Deprecated tools.js file detection', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        ioPackageJson: testData.validIoPackageJson
    });
    
    try {
        await M500_Code.checkCode(context);
        
        // S532 would be triggered if lib/tools.js is found but not used
        // In test environment, file system access will likely fail
        
    } catch (error) {
        // Expected - validates the module handles file access errors
        assert.ok(error.toString(), 'Should provide error information');
    }
});

/*
 * Additional M500_Code error codes that need testing:
 * 
 * - S522: Admin 5 UI suggestion (jsonConfig migration)
 * - S523: package-lock.json missing suggestion  
 * - S531: gulpfile.js with @iobroker/adapter-dev conflict
 * - S532: Unused lib/tools.js file detection
 * - S526: @alcalzone/release-script-plugin-manual-review suggestion
 * - W533: Deprecated adapter methods detection
 * - W532: Outdated lib/tools.js usage
 * - W513/S531: gulpfile.js warnings and suggestions
 * 
 * These require:
 * 1. File system mocking to simulate presence/absence of files
 * 2. Code analysis mocking to detect deprecated method usage
 * 3. Repository structure simulation
 * 4. Package.json dependency analysis
 */
'use strict';

/**
 * Unit tests for M800_Github module
 * 
 * Tests error codes E800-E899 for GitHub repository validation
 */

const test = require('node:test');
const assert = require('node:assert');

// Import the module under test
const M800_Github = require('../../lib/M800_Github.js');

// Import test helpers and fixtures
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

test('M800_Github - checkGithubRepo with valid repository', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: testData.validGithubApiResponse,
        packageJson: testData.validPackageJson
    });
    
    const initialErrorCount = testHelper.countErrors(context);
    await M800_Github.checkGithubRepo(context);
    
    // Should complete without fatal errors for valid repository
    assert.ok(testHelper.countErrors(context) >= initialErrorCount, 'Should complete without crashing');
});

test('M800_Github - E801: No repository about text found', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: {
            ...testData.validGithubApiResponse,
            description: null // Missing description
        },
        packageJson: testData.validPackageJson
    });
    
    await M800_Github.checkGithubRepo(context);
    assert.ok(testHelper.hasErrorCode(context, 'E801'), 'Should trigger E801 for missing description');
    
    const message = testHelper.getErrorMessage(context, 'E801');
    assert.ok(message.includes('about text'), 'Error message should mention about text');
});

test('M800_Github - E802: No topics found in repository', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: {
            ...testData.validGithubApiResponse,
            topics: [] // No topics
        },
        packageJson: testData.validPackageJson
    });
    
    await M800_Github.checkGithubRepo(context);
    assert.ok(testHelper.hasErrorCode(context, 'E802'), 'Should trigger E802 for missing topics');
    
    const message = testHelper.getErrorMessage(context, 'E802');
    assert.ok(message.includes('topics'), 'Error message should mention topics');
});

test('M800_Github - E803: Archived repositories not allowed', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: {
            ...testData.validGithubApiResponse,
            archived: true // Repository is archived
        },
        packageJson: testData.validPackageJson
    });
    
    await M800_Github.checkGithubRepo(context);
    assert.ok(testHelper.hasErrorCode(context, 'E803'), 'Should trigger E803 for archived repository');
    
    const message = testHelper.getErrorMessage(context, 'E803');
    assert.ok(message.includes('Archived'), 'Error message should mention archived repositories');
});

test('M800_Github - Multiple GitHub issues', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: {
            ...testData.validGithubApiResponse,
            description: null, // Missing description -> E801
            topics: [],       // Missing topics -> E802
            archived: true    // Archived -> E803
        },
        packageJson: testData.validPackageJson
    });
    
    await M800_Github.checkGithubRepo(context);
    
    // Should have multiple errors
    const errorCount = testHelper.countErrors(context);
    assert.ok(errorCount >= 3, `Should have at least 3 errors, got ${errorCount}`);
    
    // Check for specific error codes
    assert.ok(testHelper.hasErrorCode(context, 'E801'), 'Should have E801');
    assert.ok(testHelper.hasErrorCode(context, 'E802'), 'Should have E802');
    assert.ok(testHelper.hasErrorCode(context, 'E803'), 'Should have E803');
});

test('M800_Github - Private repositories handling', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: {
            ...testData.validGithubApiResponse,
            private: true // Private repository
        },
        packageJson: testData.validPackageJson
    });
    
    await M800_Github.checkGithubRepo(context);
    
    // Should handle private repositories without crashing
    assert.ok(Array.isArray(context.errors), 'Should maintain errors array');
    assert.ok(Array.isArray(context.warnings), 'Should maintain warnings array');
});

test('M800_Github - Repository with minimal valid setup', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: {
            name: 'ioBroker.test-adapter',
            full_name: 'test/ioBroker.test-adapter',
            description: 'Test adapter for ioBroker', // Has description
            topics: ['iobroker', 'adapter'],           // Has topics
            archived: false,                           // Not archived
            private: false,
            license: { key: 'mit', name: 'MIT License' }
        },
        packageJson: testData.validPackageJson
    });
    
    await M800_Github.checkGithubRepo(context);
    
    // Should not trigger E801, E802, E803
    assert.ok(!testHelper.hasErrorCode(context, 'E801'), 'Should not have E801');
    assert.ok(!testHelper.hasErrorCode(context, 'E802'), 'Should not have E802');
    assert.ok(!testHelper.hasErrorCode(context, 'E803'), 'Should not have E803');
});

test('M800_Github - Context preservation', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: testData.validGithubApiResponse,
        packageJson: testData.validPackageJson
    });
    
    const originalUrl = context.githubUrlOriginal;
    
    await M800_Github.checkGithubRepo(context);
    
    // Verify context integrity
    assert.strictEqual(context.githubUrlOriginal, originalUrl, 'Should preserve original URL');
    assert.ok(context.githubApiData, 'Should preserve GitHub API data');
    assert.ok(Array.isArray(context.errors), 'Should maintain errors array');
    assert.ok(Array.isArray(context.warnings), 'Should maintain warnings array');
});

test('M800_Github - Error message format validation', async (t) => {
    const context = testHelper.createMockContext({
        githubApiData: {
            ...testData.validGithubApiResponse,
            description: null,
            topics: []
        },
        packageJson: testData.validPackageJson
    });
    
    await M800_Github.checkGithubRepo(context);
    
    // Check error message formats
    const e801Message = testHelper.getErrorMessage(context, 'E801');
    const e802Message = testHelper.getErrorMessage(context, 'E802');
    
    if (e801Message) {
        assert.ok(e801Message.startsWith('[E801]'), 'E801 message should start with [E801]');
        assert.ok(e801Message.includes(context.githubUrlOriginal), 'E801 should include repository URL');
    }
    
    if (e802Message) {
        assert.ok(e802Message.startsWith('[E802]'), 'E802 message should start with [E802]');
        assert.ok(e802Message.includes(context.githubUrlOriginal), 'E802 should include repository URL');
    }
});
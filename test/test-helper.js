'use strict';

/**
 * Test helper utilities for ioBroker.repochecker tests
 */

const path = require('node:path');

// Import config module to initialize properly
const config = require('../lib/config.js');

/**
 * Create a mock context object for testing
 * @param {Object} options - Options to override default context
 * @returns {Object} Mock context object
 */
function createMockContext(options = {}) {
    const defaultContext = {
        errors: [],
        warnings: [],
        checks: [],
        githubUrlOriginal: 'https://github.com/test/ioBroker.test-adapter',
        githubUrlApi: 'https://api.github.com/repos/test/ioBroker.test-adapter',
        repository: 'test/ioBroker.test-adapter',
        branch: 'main',
        packageJson: null,
        ioPackageJson: null,
        readmeContent: null,
        licenseContent: null,
        isLocal: false,
        debug: false,
        info: false,
        success: false,
        // Add common.js environment simulation
        libraryRoot: path.join(__dirname, '..', '..'),
        // Add required GitHub API data
        githubApiData: {
            html_url: 'https://github.com/test/ioBroker.test-adapter',
            git_url: 'git://github.com/test/ioBroker.test-adapter.git',
            ssh_url: 'git@github.com:test/ioBroker.test-adapter.git',
            clone_url: 'https://github.com/test/ioBroker.test-adapter.git',
            description: 'Test adapter for ioBroker',
            topics: ['iobroker', 'adapter', 'test'],
            archived: false,
            private: false,
            license: {
                key: 'mit',
                name: 'MIT License'
            }
        },
        // Add npm data
        npmData: {
            name: 'iobroker.test-adapter',
            version: '1.0.0',
            '@iobroker/adapter-core': {
                required: '3.2.3',
                recommended: '3.3.2'
            }
        },
        ...options
    };
    
    // Initialize configuration
    config.initConfig(defaultContext);
    
    return defaultContext;
}

/**
 * Check if an error/warning/suggestion code is present in the context
 * @param {Object} context - Test context
 * @param {string} code - Error/warning/suggestion code (e.g., 'E001', 'W127', 'S052')
 * @returns {boolean} True if code is found
 */
function hasErrorCode(context, code) {
    const allMessages = [...context.errors, ...context.warnings];
    return allMessages.some(msg => msg.includes(`[${code}]`));
}

/**
 * Get the message for a specific error/warning/suggestion code
 * @param {Object} context - Test context
 * @param {string} code - Error/warning/suggestion code
 * @returns {string|null} The message or null if not found
 */
function getErrorMessage(context, code) {
    const allMessages = [...context.errors, ...context.warnings];
    const message = allMessages.find(msg => msg.includes(`[${code}]`));
    return message || null;
}

/**
 * Count total number of errors in context
 * @param {Object} context - Test context
 * @returns {number} Number of errors
 */
function countErrors(context) {
    return context.errors.length;
}

/**
 * Count total number of warnings in context
 * @param {Object} context - Test context
 * @returns {number} Number of warnings
 */
function countWarnings(context) {
    return context.warnings.length;
}

/**
 * Reset context arrays for clean testing
 * @param {Object} context - Test context
 */
function resetContext(context) {
    context.errors = [];
    context.warnings = [];
    context.checks = [];
}

/**
 * Mock the common.js debug/info/warn functions for testing
 * @param {Object} context - Test context
 */
function mockCommonFunctions(context) {
    // Override console functions during tests to capture output
    const originalLog = console.log;
    const originalError = console.error;
    
    const capturedOutput = {
        log: [],
        error: []
    };
    
    console.log = (...args) => {
        capturedOutput.log.push(args.join(' '));
        if (context.debug || context.info) {
            originalLog(...args);
        }
    };
    
    console.error = (...args) => {
        capturedOutput.error.push(args.join(' '));
        originalError(...args);
    };
    
    return {
        restore: () => {
            console.log = originalLog;
            console.error = originalError;
        },
        getCapturedOutput: () => capturedOutput
    };
}

/**
 * Create a promise that resolves with the given context after a delay
 * @param {Object} context - Context to return
 * @param {number} delay - Delay in milliseconds (default: 0)
 * @returns {Promise<Object>} Promise resolving to context
 */
function resolveWithContext(context, delay = 0) {
    return new Promise(resolve => {
        setTimeout(() => resolve(context), delay);
    });
}

/**
 * Create a promise that rejects with the given error
 * @param {Error} error - Error to reject with
 * @returns {Promise} Promise that rejects
 */
function rejectWithError(error) {
    return Promise.reject(error);
}

module.exports = {
    createMockContext,
    hasErrorCode,
    getErrorMessage,
    countErrors,
    countWarnings,
    resetContext,
    mockCommonFunctions,
    resolveWithContext,
    rejectWithError
};
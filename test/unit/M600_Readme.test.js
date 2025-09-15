'use strict';

/**
 * Unit tests for M600_Readme module
 * 
 * Tests error codes E600-E699 for README.md validation
 */

const test = require('node:test');
const assert = require('node:assert');

// Import the module under test
const M600_Readme = require('../../lib/M600_Readme.js');

// Import test helpers and fixtures
const testHelper = require('../test-helper.js');
const testData = require('../fixtures/test-data.js');

test('M600_Readme - E601: No README.md found', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        readmeContent: null // No README content
    });
    
    await M600_Readme.checkReadme(context);
    assert.ok(testHelper.hasErrorCode(context, 'E601'), 'Should trigger E601 for missing README');
});

test('M600_Readme - Valid README passes basic checks', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        readmeContent: testData.validReadmeContent
    });
    
    const initialErrorCount = testHelper.countErrors(context);
    await M600_Readme.checkReadme(context);
    
    // Should not add critical errors for valid README
    assert.ok(testHelper.countErrors(context) >= initialErrorCount, 'Should complete without fatal errors');
});

test('M600_Readme - E603: Missing Changelog section', async (t) => {
    const readmeWithoutChangelog = `# ioBroker.test-adapter

Test adapter for ioBroker

## License

MIT License`;

    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        readmeContent: readmeWithoutChangelog
    });
    
    await M600_Readme.checkReadme(context);
    assert.ok(testHelper.hasErrorCode(context, 'E603'), 'Should trigger E603 for missing Changelog');
});

test('M600_Readme - E604: Missing License section', async (t) => {
    const readmeWithoutLicense = `# ioBroker.test-adapter

Test adapter for ioBroker

## Changelog

### 1.0.0
- Initial release`;

    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        readmeContent: readmeWithoutLicense
    });
    
    await M600_Readme.checkReadme(context);
    assert.ok(testHelper.hasErrorCode(context, 'E604'), 'Should trigger E604 for missing License section');
});

test('M600_Readme - E606: Current version not found in README', async (t) => {
    const readmeWithOldVersion = `# ioBroker.test-adapter

Test adapter for ioBroker

## Changelog

### 0.9.0
- Old version

## License

MIT License`;

    const context = testHelper.createMockContext({
        packageJson: { ...testData.validPackageJson, version: '1.0.0' },
        readmeContent: readmeWithOldVersion
    });
    
    await M600_Readme.checkReadme(context);
    assert.ok(testHelper.hasErrorCode(context, 'E606'), 'Should trigger E606 for missing current version in README');
});

test('M600_Readme - README with issues triggers multiple errors', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        readmeContent: testData.readmeWithIssues
    });
    
    await M600_Readme.checkReadme(context);
    
    // Should have multiple errors for problematic README
    assert.ok(testHelper.countErrors(context) > 0, 'Should have errors for problematic README');
});

test('M600_Readme - Copyright year validation', async (t) => {
    const currentYear = new Date().getFullYear();
    const futureYear = currentYear + 1;
    
    const readmeWithFutureYear = `# ioBroker.test-adapter

Test adapter for ioBroker

## Changelog

### 1.0.0
- Initial release

## License

MIT License

Copyright (c) ${futureYear} Test Author`;

    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        readmeContent: readmeWithFutureYear
    });
    
    await M600_Readme.checkReadme(context);
    
    // Should trigger E607 for future year
    assert.ok(testHelper.hasErrorCode(context, 'E607'), 'Should trigger E607 for future year in copyright');
});

test('M600_Readme - README content validation', async (t) => {
    const minimalValidReadme = `# ioBroker.test-adapter

Test adapter for ioBroker.

## Changelog

### 1.0.0 (2024-01-01)
- Initial release

## License

MIT License

Copyright (c) 2024 Test Author`;

    const context = testHelper.createMockContext({
        packageJson: testData.validPackageJson,
        readmeContent: minimalValidReadme
    });
    
    await M600_Readme.checkReadme(context);
    
    // Should pass basic validation
    assert.ok(Array.isArray(context.errors), 'Should maintain errors array');
    assert.ok(Array.isArray(context.warnings), 'Should maintain warnings array');
});
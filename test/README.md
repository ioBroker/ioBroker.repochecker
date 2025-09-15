# Test Suite for ioBroker.repochecker

This directory contains comprehensive tests for the ioBroker.repochecker tool, validating that all error codes, warnings, and suggestions are properly triggered.

## Test Structure

```
test/
├── test-runner.js           # Main test runner script
├── test-helper.js           # Test utilities and helper functions
├── fixtures/
│   └── test-data.js         # Test data fixtures
├── unit/                    # Unit tests for individual modules
│   ├── M000_PackageJson.test.js       # Tests for package.json validation (E001-E099)
│   ├── M100_IOPackageJson.test.js     # Tests for io-package.json validation (E100-E249)
│   ├── error-code-coverage.test.js    # Systematic error code coverage tests
│   └── working-tests.test.js          # Currently working test cases
└── integration/             # Integration tests
    └── main-checker.test.js  # End-to-end checker tests
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Files
```bash
# Run only unit tests
node --test test/unit/

# Run only integration tests  
node --test test/integration/

# Run specific test file
node --test test/unit/working-tests.test.js

# Run tests matching pattern
node --test --test-name-pattern="forbidden" test/unit/working-tests.test.js
```

### Manual Test Runner
```bash
# Use the custom test runner
node test/test-runner.js
```

## Test Coverage Goals

The test suite aims to cover all error codes, warnings, and suggestions defined in the repochecker:

### Package.json Validation (E001-E099)
- **E002**: Missing ioBroker prefix in package name ✅
- **E003**: Missing main field
- **E017**: Missing repository field
- **E074**: @iobroker/testing in dependencies instead of devDependencies
- And many more...

### IO-package.json Validation (E100-E249)  
- **E100**: Cannot parse io-package.json ✅
- **W127**: Missing titleLang translations
- **W134**: Missing desc translations
- **W128**: Title contains "adapter"
- **W168**: Forbidden keywords
- **W113**: Missing compact mode specification
- **S139**: Compact mode suggestion
- And many more...

### Other Modules (E250+)
- **M250_Npm**: NPM-related checks
- **M300_Testing**: Testing-related checks  
- **M400_Repository**: Repository structure checks
- **M500_Code**: Code analysis checks
- **M600_Readme**: README validation
- **M700_License**: License validation
- **M800_Github**: GitHub-specific checks
- **M900_GitNpmIgnore**: Ignore file checks

## Test Utilities

### Test Helper Functions

```javascript
const testHelper = require('./test-helper.js');

// Create mock context for testing
const context = testHelper.createMockContext({
    packageJson: somePackageJson,
    ioPackageJson: someIoPackageJson
});

// Check if specific error code was triggered
const hasError = testHelper.hasErrorCode(context, 'E002');

// Get error message for specific code
const message = testHelper.getErrorMessage(context, 'E002');

// Count errors and warnings
const errorCount = testHelper.countErrors(context);
const warningCount = testHelper.countWarnings(context);
```

### Test Fixtures

```javascript
const testData = require('./fixtures/test-data.js');

// Valid test data
testData.validPackageJson
testData.validIoPackageJson

// Invalid test data to trigger specific errors
testData.invalidPackageJson
testData.packageJsonWithDependencyIssues
testData.ioPackageJsonMissingTranslations
```

## Adding New Tests

### For New Error Codes

1. **Create test case in appropriate module test file**:
```javascript
test('Error Coverage - E123: Description of error', async (t) => {
    const context = testHelper.createMockContext({
        packageJson: {
            // Setup data that should trigger E123
        }
    });
    
    await ModuleName.checkFunction(context);
    assert.ok(testHelper.hasErrorCode(context, 'E123'), 'Should trigger E123');
});
```

2. **Add test fixtures if needed** in `test/fixtures/test-data.js`

3. **Document the test** in the comments section of relevant test files

### For New Modules

1. **Create new test file** `test/unit/M###_ModuleName.test.js`
2. **Follow existing patterns** for test structure
3. **Import module and test each exported function**
4. **Add integration test** in `test/integration/`

## Test Infrastructure

### Node.js Test Runner

Tests use Node.js built-in test runner (available in Node.js 18+):
- Native `test()` and `assert` functions
- TAP output format
- Parallel test execution
- Pattern matching for selective test runs

### Mock Context

The test helper creates a properly initialized context object with:
- Configuration initialized via `config.initConfig()`
- GitHub API data structure
- NPM data structure  
- All required arrays (errors, warnings, checks)

### CI/CD Integration

Tests run automatically on:
- Push to main/master/dev branches
- Pull requests
- Multiple Node.js versions (18.x, 20.x, 22.x)

See `.github/workflows/test.yml` for CI configuration.

## Current Test Status

### ✅ Working Tests
- Basic package.json validation
- Forbidden dependency detection (npm, iobroker.js-controller, etc.)
- Deprecated package warnings (request)
- publishConfig suggestions (S052)
- JSON parse error simulation (E100)
- Integration test framework
- Test helper utilities

### ⚠️ Partial Coverage
- Some error codes work but need more comprehensive test cases
- Context setup needs refinement for complex scenarios
- Network-dependent tests need mocking

### ❌ Missing Tests
- Complete coverage of all E/W/S codes
- File system operations (M400, M500, M600, M700, M900)
- Network operations (M250, M800)
- Complex validation logic (M300)

## Development Notes

### Test Philosophy
- **Focused tests**: Each test targets specific error codes
- **Minimal setup**: Use helper functions to reduce boilerplate
- **Clear naming**: Test names indicate which error code is being tested
- **Documentation**: Comments explain what each test validates

### Performance Considerations
- Tests avoid network requests where possible
- Mock data is used instead of real repository access
- Parallel execution for faster test runs

### Future Improvements
1. **Mock network requests** for complete offline testing
2. **File system mocking** for repository structure tests
3. **More comprehensive fixtures** covering edge cases
4. **Performance benchmarking** for large repository validation
5. **Integration with real repositories** for end-to-end validation

## Troubleshooting

### Common Issues

**Tests fail with "Cannot read properties of undefined"**
- Usually indicates missing context properties
- Check that mock context includes all required fields
- Verify configuration is properly initialized

**Network-related test failures**  
- Expected in sandboxed environments
- These tests validate error handling for network issues

**Missing error codes in output**
- Verify test data actually triggers the condition
- Check that module logic paths are correctly followed
- Ensure context has required dependencies/devDependencies structure

### Debug Mode

Run tests with additional debugging:
```bash
# Enable debug output in tests
DEBUG=true npm test

# Run single test with verbose output
node --test --test-reporter=tap test/unit/working-tests.test.js
```
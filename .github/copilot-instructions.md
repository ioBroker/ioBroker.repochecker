# GitHub Copilot Instructions for ioBroker.repochecker

## Code Contribution Guidelines

### Minimize all activity to save tokens
- **DO NOT** modify comment on or close issues that are resolved by a PR.
- **DO NOT** modify README.ms or any other file.
- **DO NOT** perform linting
- **DO NOT** change any version numbers, version management is done externally
#### Dependencies
- Only add new dependencies if absolutely necessary
- Use exact versions or compatible ranges following semver
- Update devDependencies when adding development tools
- Test that all dependencies work correctly with `npm install`

#### File Structure
- Main application logic is in `index.js`
- Library modules are in the `lib/` directory
- Documentation files are in the `doc/` directory
- Frontend code is in the `frontend/` directory
- Scripts are in the `scripts/` directory

### Testing Guidelines
- The repository currently has no automated test suite
- Minimize testing effort and cost
- restrict tests to changes applied and neede to verify success of changed

### Development Workflow
- Make minimal, focused changes

#### Checker Logic
- The main checking logic is modularized in the `lib/` directory
- Each module handles specific aspects of repository validation
- Error codes follow the pattern E### for errors, W### for warnings, S### for suggestions
- Maintain consistency with existing error/warning numbering

#### File Processing
- The checker downloads and analyzes files from GitHub repositories
- Support for both GitHub API and local file analysis
- Handle missing files gracefully
- Respect rate limits and implement appropriate error handling

#### Schema URLs
- When referencing schema URLs for io-package.json or jsonConfig validation, use the constants defined in `lib/config.js` via `config.schemaUrls`
- **DO NOT** hardcode schema URLs directly in the code - always use the centralized definitions from `lib/config.js`
- Available schema URLs: `config.schemaUrls['io-package']` and `config.schemaUrls.jsonConfig`


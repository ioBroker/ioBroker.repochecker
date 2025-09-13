# GitHub Copilot Instructions for ioBroker.repochecker

This document provides specific guidance for GitHub Copilot when working on the ioBroker.repochecker repository.

## Repository Overview

This repository contains the code for the frontend and backend of the service <https://adapter-check.iobroker.in/>, which validates ioBroker adapter repositories before they can be added to the public ioBroker repository.

## Code Contribution Guidelines

### Issue Management
- **DO NOT** close issues that are resolved by a PR.
- **DO NOT** add a note 'Fixes ...' to comments of any PR created.
- **DO** attach the label 'fixed' to resolved issues
- **DO** add a reference to the PR as a comment on the resolved issue
- Let the maintainers handle the actual closing of issues

### Changelog Management
- **ALL** changes must be added to the changelog section in README.md
- Add changes below the `### **WORK_IN_PROGRESS**` heading
- **DO NOT** remove or modify the template comment for `### **WORK_INPROGRESS**`
- Follow the existing changelog format with version, date, and itemized changes
- Use the format: `- (author) Description of change [#issue_number].`

### Code Quality Standards

#### Linting and Formatting
- Run `npm run lint` before submitting any changes
- The project uses ESLint with `@iobroker/eslint-config`
- Fix any linting errors before committing
- Use `npm run lint -- --fix` to automatically fix formatting issues

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
- Manual testing should be performed by running the checker against known repositories
- Use `npx @iobroker/repochecker <repo> [branch]` to test changes
- Test with both the `--local` and `--debug` flags when appropriate

### Development Workflow
1. Create a new branch for your changes
2. Make minimal, focused changes
3. Run linting: `npm run lint`
4. Test your changes manually
5. Update the changelog in README.md
6. Commit with descriptive messages
7. Create a PR with detailed description
8. Add 'fixed' label to related issues (don't close them)

### Specific Technical Considerations

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

#### Version Management
- Version numbers follow semantic versioning
- Release scripts are configured for automated releases
- Update version in package.json only through release process

## Repository-Specific Notes

### Maintainer Information
- The current maintainers manage releases and issue resolution
- For adding new maintainers to package.json, create a separate PR specifically for that change
- Contact information for maintainers can be found in the issue or PR discussions

### Release Process
- Uses `@alcalzone/release-script` for automated releases
- Release notes are generated from changelog entries
- Versions are bumped automatically during release process

### External Dependencies
- Minimal external dependencies by design
- Uses axios for HTTP requests, semver for version handling
- Image processing capabilities via image-size package
- JSON5 support for configuration files

## Best Practices

1. **Minimal Changes**: Make the smallest possible changes to achieve the goal
2. **Backward Compatibility**: Ensure changes don't break existing functionality
3. **Documentation**: Update documentation when adding new features
4. **Error Handling**: Implement robust error handling for network requests and file processing
5. **Performance**: Consider performance impact of changes, especially for large repositories
6. **Consistency**: Follow existing code patterns and naming conventions

Remember: This is a critical tool used by the ioBroker community to validate adapter repositories. Changes should be thoroughly tested and carefully considered for their impact on the ecosystem.

### **CRITICAL REQUIREMENTS**
**NEVER use keywords that automatically close issues.** Issues must be closed manually by maintainers after validation.

**Key Rules:**
1. Use "Related to #123" instead of "Fixes #123" 
2. Add "fixed" label when PR fully addresses an issue (if you have permissions)
3. Issues are closed manually by maintainers, not by PR merge

### Issue Handling Guidelines
When creating PRs that address GitHub issues, follow these specific practices:

**NEVER** use GitHub keywords that automatically close issues (like "fixes", "closes", "resolves") in PR titles or descriptions. Instead:

1. **Link without closing**: Reference issues using neutral language:
   - Use "Related to #123" instead of "Fixes #123"
   - Use "Addresses #123" instead of "Closes #123"
   - Use "Implements #123" instead of "Resolves #123"

2. **Add issue comments**: After creating a PR, add a comment to the referenced issue with:
   - Link to the PR
   - Brief description of the changes made
   - Request for review/testing if applicable

3. **Set issue labels**: When a PR fully addresses an issue, manually set the "fixed" label on the issue (if you have permissions).

### Changelog Management
**ALWAYS** add a user-focused changelog entry for every PR to the README.md file:

1. **Location**: Add entries under the "### **WORK IN PROGRESS**" section in README.md
2. **Format**: Follow the existing changelog format:
   ```
   - (@your-username) Brief user-focused description of the change
   ```
3. **Style**: Keep entries concise and focused on user impact, not technical implementation details
4. **Examples**:
   - Good: "Fixed login issues with special characters in passwords"
   - Bad: "Refactored authentication service to handle URL encoding"


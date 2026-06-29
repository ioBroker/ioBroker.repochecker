# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Does

Validates ioBroker adapter repositories for compliance. Two main use cases:
1. **Repo checking** — an Express/Lambda server that takes an adapter repo URL, downloads it, and runs ~100+ checks returning JSON with errors/warnings.
2. **Object structure validation** — a standalone validator for ioBroker object dump JSON files (state schemas, hierarchy, roles).

## Commands

```bash
npm start                                          # Start Express server (PORT env or 3005)
npx @iobroker/repochecker <repo-url> [branch] [--debug] [--local] [--noinfo] [--strict]  # CLI
node scripts/checkObjectStructure.js <path-to-json> # Validate object dump
```

No automated test suite exists.

## Architecture

### Repo Checker Pipeline

`index.js` → sequential promise chain, each stage enriches a `context` object:

1. **M0000_PackageJson** — package.json validation
2. **M1000_IOPackageJson** — io-package.json validation
3. **M2000_Npm** — npm registry checks
4. **M3000_Testing** — test-and-release.yml workflow, Node.js versions
5. **M4000_Repository** — ioBroker repository presence
6. **M5000_Code** — source code scanning (imports, timers, Sentry, env)
7. **M6000_Readme** — README structure & language
8. **M7000_License** — LICENSE file & copyright years
9. **M8000_Github** — workflow files, GitHub settings
10. **M9000_GitNpmIgnore** — .npmignore & .gitignore
11. **Postprocessing** — severity remapping for new adapters

### Object Structure Validator

`lib/objectStructure.js` — Pure function (no I/O, no logging). Validates parsed ioBroker object dumps against schemas in `lib/config_StateRoles.js`. Returns `{ adapter, objectCount, errors: [{code, message}], warnings: [{code, message}] }`. Module uses externally by github workflows.

`scripts/checkObjectStructure.js` — CLI wrapper.


### Key Modules

- **`lib/common.js`** — Logging, file/URL caching, GitHub API calls, semver handling
- **`lib/config.js`** — Constants (languages, licenses, Node versions, schema URLs)
- **`lib/postprocessing.js`** — Severity remapping for new adapters

## Conventions

- **Readable code**: prefer human readable code ove high sophiticated or optimaized implementaions. Add comments where needed.
- **Error codes**: E#### (error), W#### (warning), S#### (suggestion). Ranges match module numbering (0000–0999 = package.json, 1000–1999 = io-package.json, etc.). Maintain consistency with existing numbering. Ensure that numbers are not duplicated and are with the range assigned to the files containing the code. 
- **Schema URLs**: Always use `config.schemaUrls['io-package']` and `config.schemaUrls.jsonConfig` from `lib/config.js` — never hardcode.
- **Minimal changes**: Make focused changes. Do not modify version numbers, or unrelated files.
- **Dependencies**: Only add if absolutely necessary; use exact or semver-compatible ranges.
- **Changelog**: always add a changelog entry into README.md.

## README Changelog

Every PR must add a user-friendly entry in `README.md` under `## **WORK IN PROGRESS**` using the format:

```
* (author) **TYPE**: Description of user-visible change
```

Accepted types: **NEW** (feature), **FIXED** (bug fix), **ENHANCED** (improvement), **TESTING** (tests), **CI/CD** (automation). Focus on user impact, not technical details. Reference issues with `fixes #XX` or `solves #XX`. On release, the release-script replaces the `WORK IN PROGRESS` heading with the version number and date.

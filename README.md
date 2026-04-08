# Adapter repository checker

This is a code for frontend and back-end of the service <https://adapter-check.iobroker.in/>

If you want to add your adapter to the public ioBroker repository, all tests on this page must be OK.

## How to test via cli

When running the repository checker via the command line, you **need** to add the repository as parameter, while the branch parameter (`master/main/dev`) is optional. If this parameter is omitted, the `default` branch (typically master / main) will be checked.

```
npx @iobroker/repochecker <repo> [branch]`
```

For extra debugging outputs you can pass the `--debug` parameter.

For a local test you can pass the `--local` parameter. Most of the files are read locally.
The link to the GitHub repository is still necessary because data from the project settings on GitHub is also checked.

Example:

`npx @iobroker/repochecker https://github.com/ioBroker/ioBroker.repochecker --local`

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
- (@copilot) Added `isNewAdapter` flag: set to `true` when adapter is not listed in the latest repository, with an info log when set.
- (@copilot) Added `--strict` command line option: when active, outputs an info log "running in strict mode".
- (@copilot) `[S6020]` suggestion to add `CHANGELOG_OLD.md` is now only shown when `isNewAdapter` is set or strict mode is active.

### 5.9.0 (2026-04-08)
- (@copilot) Added checks W1114/S1114: warn when `common.schedule` is set to a non-empty value for daemon adapters (not supported), and suggest removal when `common.schedule` is an empty string for daemon adapters (unused). Related to [#806].
- (@copilot) Added checks to help maintain organized changelog files: warns when CHANGELOG.md is present (changelog belongs in README.md), when both CHANGELOG.md and CHANGELOG_OLD.md coexist, when the README changelog exceeds 20 entries without a CHANGELOG_OLD.md, and suggests adding CHANGELOG_OLD.md when no such file exists. [W6017, W6018, W6019, S6020]

### 5.8.0 (2026-04-07)
- (@copilot) Limit the listing of `allowedValues` in schema validation errors (E1105, W5512) to 5 values, appending `...` when there are more possibilities.
- (@copilot) [W5046] Added warning when `admin/jsonConfig.json` or `admin/jsonConfig.json5` is present but `common.adminUI.config` is not set to `"json"` in `io-package.json`.
- (@copilot) [W5047] Added warning listing obsolete files (`admin/index.html`, `admin/index_m.html`, `admin/style.css`) when jsonConfig is used.

### 5.7.1 (2026-04-07)
- (mcm1957) Improve jsonConfig schema validation messages.

### 5.7.0 (2026-04-06)
- (@copilot) [S8913] automerge suggestion is no longer shown when dependabot is not configured ([S8901]).
- (@copilot) Language detection: `GERMAN_WORDS` and `ENGLISH_WORDS` arrays sorted alphabetically; chapters titled "Haftungsausschluss" in README.md are now ignored when checking for German text.
- (@copilot) Added [W8915]: warn when a dependabot npm entry has no cooldown or a cooldown of less than 5 days configured, recommending at least 7 days to reduce supply chain risk.
- (@copilot) Added JSON5 support for `jsonTab.json5`: `admin/jsonTab.json` and `admin/jsonTab.json5` are now read and parsed; E5044 is raised for parse errors and E5045 when the file is missing but tab support is declared. [#780]
- (@copilot) Fixed false-positive W4042/W4044 warnings for adapters using only `jsonConfig.json5`: the VS Code schema checks now detect which config files actually exist in the repository and use `some()` instead of `every()` to match schema entries, preventing false warnings when a valid json5-only schema is configured. [#780]
- (@copilot) Added schema validation for all present jsonConfig files (`admin/jsonConfig.json`, `admin/jsonCustom.json`, `admin/jsonTab.json` and their `.json5` variants) against the official jsonConfig JSON schema; errors reported as E5512, schema download failures as W5513, and exceptions as E5514. [#803]

### 5.6.9 (2026-04-02)
- (mcm1957) Ignore "widgets" directory when scanning for imported packages.

### 5.6.7 (2026-04-02)
- (@copilot) Fixed false positive package detection in `extractImports`: dynamic imports like `import("pkg")` no longer incorrectly trigger the `import ... from ...` pattern, preventing values in log strings (e.g. `from 'force_full'`) from being mistaken for package names.

### 5.6.6 (2026-03-29)
- (mcm1957) Severity for [S3010] has been corrected.

### 5.6.5 (2026-03-27)
- (@copilot) Exclude `gulpfile.js` and `lib/tools.js` from W5042/S5043 dependency scanning; added easy-to-extend `excludedSourceFiles` and `excludedSourceRelPaths` Sets for future exclusions.

### 5.6.2 (2026-03-27)
- (@copilot) Suppress unwanted npm E404 error output when checking adapters that are not published on npm.
- (@copilot) Added E2006 error when an npm package has no published versions available, instead of silently skipping version checks.
- (@copilot) Handle unpublished npm packages: detect "Unpublished on ..." response from npm registry and report a specific E2000 error instead of the generic "not found" message; suppress raw npm error logs for unpublished packages in README/LICENSE year checks. [#766]
- (@copilot) Fixed crash in checkNpm (E2000-E2999) when npm package has no `dist-tags` or `versions` field in registry response. [#764].
- (@copilot) Added W5042 and S5043 checks: source files (`*.js`, `*.mjs`, `*.cjs`, `*.ts`) are now scanned for `require`/`import` statements (excluding `admin/`, `doc/`, `src-admin/`, `test/` directories and `*.test.*`/`*.config.*` files). W5042 warns when an imported package is not listed in `dependencies` of `package.json`. S5043 suggests using the `node:` prefix when importing known Node.js built-in modules without it.

### 5.5.5 (2026-03-24)
- (mcm1957) remove '[S6014] README.md section "## Installation" should be removed unless the adapter requires special installation handling.'

### 5.5.4 (2026-03-22)
- (@copilot) Fixed E6015/W6016 false positives: German (and English) language detection now ignores fenced code blocks, inline code, blockquote lines, link URLs, and image markup before analyzing the README text.

### 5.5.3 (2026-03-19)
- (@copilot) Fixed E3016 false positive: transitive `needs` dependencies are now considered, so `deploy` depending on `adapter-tests` which already depends on `check-and-lint` is correctly accepted. Related to [#756].
- (@copilot) W5041 warning now includes the list of languages that contain the example keys (e.g. `languages: en, de, ru`).

### 5.5.2 (2026-03-17)
- (@copilot) E5040 and W5041 messages now include the specific detected key(s) (e.g. `option1`, `option2`, or both) instead of the generic `option1/option2` placeholder. Only one issue is raised even when multiple keys are detected.
- (@copilot) Fixed E1111/W1111 checks: E1111 and W1111 are now renamed to E5040 and W5041 (correct numbering range for M5000_Code module). Both checks now correctly exempt adapters where `option1`/`option2` keys are genuinely used in `admin/index.html`, `admin/index_m.html`, or as keys in `admin/jsonConfig.json`/`admin/jsonConfig.json5`. Related to [#746].

### 5.5.1 (2026-03-17)
- (@copilot) Added W5039 check: warns when `admin/words.js` exists but is not referenced anywhere in the codebase for adapters using jsonConfig. The file seems to be outdated and should be removed [#745].
- (@copilot) Added W3018 and W3019 checks: when deploy job uses `ioBroker/testing-action-deploy@v1`, warns if job-level permissions (`contents: write`, `id-token: write`) are missing (W3018) or if the `npm-token` parameter is specified (W3019), as trusted publishing will not work in either case. Related to [#742].
- (@copilot) Added W1113 check: warns when `native` config object contains properties but `common.adminUI.config` is set to `"none"`, as the native config will not be used without an admin UI config.
- (@copilot) Added E1112 check: error when `notifications` in `io-package.json` are not translated into all supported languages (en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn) [#734].
- (@copilot) Fixed E3016 false positive: no longer requires `deploy` job to declare `needs` for `check-and-lint`/`adapter-tests` when those jobs do not exist in the workflow (e.g. `onlyWWW` adapters). Related to [#733].
- (@copilot) Added E6015 check: error when README.md contains German language words. Added W6016 check: warning when README.md does not appear to be written in English.
- (@copilot) Multiple S8906 suggestions for dependabot entries using `schedule: interval: monthly` are now combined into a single suggestion. [#696]
- (@copilot) Added W1111 check: warns when example configuration keys `option1`/`option2` are found in `io-package.json` native section or i18n translation files. Only one warning is issued even if both locations contain example config.
- (@copilot) Added E6012 check: error when README.md contains direct npm install instructions (`npm install iobroker.*`, `npm i iobroker.*`, `cd /opt/iobroker`). Related to [#722].
- (@copilot) Added E6013 check: error when README.md instructs users to install from GitHub using `iobroker url`. Related to [#722].
- (@copilot) Added S6014 suggestion: when README.md contains an `## Installation` section. Related to [#722].
- (@copilot) Extended E6013 check: now also triggers on "Install the adapter via ioBroker Admin as a ZIP file" and "Install from own URL" phrases (case-insensitive). Related to [#727].

### 5.4.1 (2026-03-13)
- (mcm197) E3008 has been fixed

### 5.4.0 (2026-03-11)
- (@copilot) OnlyWWW adapters no longer require testing dependencies or adapter test workflows (skips E3000, E3011, and W3015 checks for adapters with `common.onlyWWW = true`).

### 5.3.0 (2026-03-11)
- (@copilot) Added validation for dependabot configuration: checks for required ecosystems (github-actions, npm), schedule settings, open-pull-requests-limit, and automerge workflow configuration (checks S8901–S8914).
- (@copilot) Extended W5034 check to also warn when `.ts` and `.js`/`.cjs`/`.mjs` versions of the same file exist in the same directory.
- (@copilot) E3003 YAML parse error for workflow files now logs only the first line (without the file excerpt).
- (@copilot) Added DEPENDABOT issue template for GitHub Copilot tasks.
- (@copilot) Extended testing checks (M3000_Testing.js): added checks for testing devDependency, test-and-release.yml workflow file presence, validity and required configuration.

### 5.2.3 (2026-02-26)
- (@copilot) Fixed crash when `devDependencies` is missing from package.json. [#675]

### 5.2.2 (2026-02-25)
- (mcm1957) Add warning if fa-icon entry still exists.
- (@copilot) Added W6011/W7004 checks: warn when copyright lines in README.md or LICENSE are separated by an empty line instead of trailing two spaces.
- (@copilot) Fixed false positive W6009/W7003: warning for non-consecutive copyright lines (separated by other text or empty lines) is no longer issued. [#672]
- (@copilot) Fixed false positive S0048/S0047 for npm alias dependencies (e.g. `"npm:real-package@^1.2.3"`). [#667]
- (@copilot) Added jsonConfig components `iframe` and `iframeSendTo` with minAdmin 7.7.28.
- (@copilot) Added jsonConfig component `yamlEditor` with minAdmin 7.7.31. [#660]
- (@copilot) Restructured `validComponents` entries in M5500__JsonConfig.js to objects with `function` and `minAdmin` properties.
- (@copilot) Added `checkDocker` and `infoBox` as known jsonConfig components to fix false-positive E5504 errors; set minAdmin 7.7.31 for `checkDocker`. [#663]
- (mcm1957) require js-controlelr 6 and admin 7 now. [#641] [#589]
- (mcm1957) required and suggested releases of standard packages have been updated.
- (mcm1957) Dependencies to packages named 'admin' and 'iobroker' have been disallowed. [#617]

### 5.1.1 (2025-12-01)
- (@copilot) Updated repository URLs from http://repo.iobroker.live to https://download.iobroker.net

### 5.1.0 (2025-11-25)
- (@copilot) Added check for conflicting JSON/JSON5 files with same base name in same directory (E5038) [#169]
- (@copilot) Added .releaseconfig.json verification to check plugins listed match installed devDependencies (E5036, W5037)
- (@copilot) Added YAML file validation check (E5035) to verify .yml and .yaml files are well-structured [#618]
- (@copilot) Added flexible conditional dependency requirements support [#609]
- (mcm1957) add warning if iobroker bot PRs are open. [#596]
- (mcm1957) remove S1094, protectedNative elements need not be encrypted. [#579]
- (mcm1957) required and suggested releases of standard pacakges have been updated.
- (mcm1957) Log errors at io-package validation as errors now.
- (mcm1957) Text for E1000 has been corrected. [#576]
- (mcm1957) Pathc information has been added to error E5509. [#394]

### 5.0.2 (2025-10-03)
- (mcm1957) Some debug log has been removed.

### 5.0.1 (2025-10-03)
- (mcm1957) A crash at adapters which do not contain news entry at io-package.json has been fixed. [#572]

### 5.0.0 (2025-10-02)
- (mcm1957) Suppress W6010 if adapter not yet published at npm. [#567]
- (@copilot) Added check for deprecated common.jsonConfig property - warns if adminUI exists (W1109), errors if adminUI missing (E1109)
- (@copilot) Added check (W0063) for unneeded devDependencies when @iobroker/testing >= 5.1.1 is installed
- (@copilot) Added check for conflicting JavaScript file extensions (.js, .cjs, .mjs) in the same directory (E5034)
- (@copilot) Improved copyright year check to find all years in multiple copyright entries and use the newest one
- (@copilot) Added check for missing trailing spaces in multiple copyright lines (W6009, W7003)
- (mcm1957) Strict mode requirements have been loosend at schema validation.
- (mcm1957) Do not log missing jsonConfig schema at vscode is no jsonConfig is used. [#548]
- (mcm1957) News entry at io-package.json is no longer required for alpha release. [#532]
- (mcm1957) Report missing README changelog for alpha releases as suggestion only. [#533]
- (mcm1957) Release of @iobroker/testing has been updated to 5.1.1.
- (mcm1957) Text for dependency update suggestion has been changed to make more clear that this should be really done. [#515]
- (mcm1957) Suggestion to migrate to jsonConfig has been changed to suggest jsonConfig or react based UI. [#524]
- (mcm1957) Alpha release are no longer reported as missing at npm / latest. [#425]
- (mcm1957) Suggestions to avoid fixed dependencies has been compressed to a maximum of one suggestion even if multiple ffixed dependencies exist [#512].
- (mcm1957) E4033 is always an error [#541].
- (mcm1957) Empty adaptername in finding has been fixed [#549].
- (mcm1957) Text for 9006 has been changed (.commitinfo hint) [#542].
- (@copilot) Renumbered all error, warning and suggestion codes from 3-digit to 4-digit format according to new numbering system
- (@copilot) Added version format validation check (E061) for invalid semver format according to ioBroker requirements
- (@copilot) Added structured GitHub issue templates for bug reports, false positives, new checks, check changes, and enhancements
- (@copilot) Fixed deprecated function checking for adapter methods called outside class context

### 4.2.0 (2025-09-20)
- (mcm1957) 'Request' replacement text changed to suggest 'node:fetch' [#498].
- (@copilot) Fixed false positive W533 warnings for deprecated adapter methods when called on local functions with same names [#520].
- (mcm1957) '[W438] .vscode/settings.json file missing "json.schemas" property' has been converted to suggestion [#516].
- (mcm1957) Severity of '[S191] admin dependency...' has been corrected [#510].
- (copilot) Added io-package.json schema validation against official schema (W205, W207, W208) [#503].
- (copilot) Added check for deprecated adapter methods (createState/createChannel/createDevice/deleteState/deleteChannel/deleteDevice) (W533) [#182].
- (copilot) Added check for outdated lib/tools.js file usage (W532) [#432].
- (copilot) Added VS Code schema definitions checker for .vscode/settings.json - validates json.schemas for io-package.json and jsonConfig files [#336].
- (copilot) Change W510 to E510: Convert missing admin i18n files from warning to error [#400].
- (copilot) Renumbered all issues in M500__JsonConfig.js from 500-511 range to 550-561 range [#481].
- (copilot) Added check for .commitinfo file - error if present (E905), warning if not in .gitignore (W906) [#467].
- (copilot) Added check for allowInit attribute [#181].
- (copilot) Added detection for empty dependency objects in io-package.json (E200, E201) [#422].
- (copilot) Added suggestion to restart 'vis-2' when 'vis' is in restartAdapters (S202) [#412].
- (copilot) Modified W513 gulpfile.js warning to check for @iobroker/adapter-dev dependency and add S531 suggestion [#469].
- (copilot) Fixed W195 warning for array elements - add W203 warning for unsupported array encryption [#399].

### 4.1.0 (2025-09-11)
- (mcm1957) eslint-config and testing suggestions have been updated.
- (mcm1957) adapter-core suggestions has been updated.
- (mcm1957) URGENT and IMPORTANT issued are watched now.
- (mcm1957) Using @iobroker/eslint-config is suggested now.
- (mcm1957) Adding @iobroker/testing to dependencies is logged as error now [#447].
- (mcm1957) Text for S191 has been extended [#393].
- (mcm1957) Text for S052 has been corrected [#434].
- (mcm1957) Formatting if W174 has been improved [#408].
- (mcm1957) @types/* as dependency now raise a warning [#421].
- (mcm1957) Dependencies have been updated.

### 4.0.2 (2025-08-12)
- (mcm1957) js-controller 6.0.11 recommended now.

### 4.0.1 (2025-08-11)
- (mcm1957) Wrong suggestion to add admin dependency has been corrected [#452].
- (mcm1957) Text for E952 has been corrected [#446].
- (mcm1957) Adapt wording at W098 / E029 [#448].
- (mcm1957) Adapter-core 3.3.1 suggestion added [#455].
- (mcm1957) Admin 7.6.17 recommendation added [#435].
- (mcm1957) jsonConfig expertMode flag added [#386].

### 4.0.0 (2025-08-05)
- (mcm1957) use jsdelivr.com to retrive files from github.
- (mcm1957) Dependencies have been updated.

### 3.5.8 (2025-05-17)
- (mcm1957) add authorization for github using OWN_GITHUB_TOKEN.

### 3.5.5 (2025-04-28)
- (mcm1957) Node.js 20 is suggested now.
- (mcm1957) Suggested release for several packages has been encreased.
- (mcm1957) Do not raise E186 if E190 is raised anyway. [#387]
- (mcm1957) Dependencies have been updated.0

### 3.5.4 (2025-03-03)
- (mcm1957) Ignore boolean paramters when checking protectedNative/encryptedNative. [#395]

### 3.5.3 (2025-02-21)
- (mcm1957) Crash has been fixed if protectedNative/encryptedNative is not an array. [#385]

### 3.5.2 (2025-02-19)
- (mcm1957) Incorrect admin suggestion for very olf html adapters corrected. [#383]
- (mcm1957) Errors during parsing if icon improved. [#381]
- (mcm1957) Crash if protectedNative or encryptedNative is missing. [#382]

### 3.5.0 (2025-02-18)
- (mcm1957) Fixed dependency warning ([W174]) has been reduces to suggestion. [#374]
- (mcm1957) Some changes to jsonConfig check have been implemented.
- (mcm1957) common.supportCustoms check has been added. [#379]
- (mcm1957) Check that key listed at encryptedNative or protectedNative is listed at native too. [#218]
- (mcm1957) Check that key listed at encryptedNative is listed at protectedNative too. [#342]
- (mcm1957) Check that extension adapters require web adapter. [#311]
- (mcm1957) List of suspicious keys to protect has been extended. [#358]
- (mcm1957) checking of 'admin'  globalDependency has been added.
- (mcm1957) checking of 'publishConfig.registry' has been added.
- (mcm1957) New commandline option --noinfo added.
- (mcm1957) Logging has been adapted.

### 3.4.4 (2025-02-12)
- (mcm1957) Some external attributes added to valid package.json attributes.

### 3.4.2 (2025-02-12)
- (mcm1957) 'type' and 'types' added to valid package.json attributes.

### 3.4.1 (2025-02-11)
- (mcm1957) Add 'publishConfig' to valid package.json attributes.

### 3.4.0 (2025-02-11)
- (mcm1957) Do not suggest to migrate to adapter-dev if only gulpfile.js exists. (#334).
- (mcm1957) Warn if onlyWWW adapter uses adapter-core (#251).
- (mcm1957) Singleton checks have been reduced to suggestion level.
- (mcm1957) Adapter-core 3.2. required now.
- (mcm1957) Blacklists for peerDependencies and optionalDependencies have been added (#364).
- (mcm1957) Suggestings for typical devDependencies have been added (#344).
- (mcm1957) Checking of package dependencies has been enhanced.
- (mcm1957) Allow legacy-testing instead of testing.
- (mcm1957) Warn if axios is listed as devDependency (#314).
- (mcm1957) Adapt common.materialize deprecation message (#315).
- (mcm1957) Log an error if dependency is listed multiple times (#316).
- (mcm1957) Check package.json for invalid attributes.
- (mcm1957) Fix duplicated warning E432 and E434.
- (mcm1957) Adapt copyright year advisory.

### 3.3.2 (2025-01-20)
- (mcm1957) Avoid crash if some file cannot be downloaded.

### 3.3.1 (2025-01-19)
- (mcm1957) Report malformed semver specifications has been fixed.

### 3.3.0 (2025-01-19)
- (mcm1957) "common.singleton" causes a warning now for non-onlyWWW Adapters.
- (mcm1957) "$schema" has been blacklisted at io-package.json.
- (mcm1957) Warn if 'common.nondeletable' flag is detected.
- (mcm1957) Report request as deprecated package.
- (mcm1957) Report malformed semver specifications.
- (mcm1957) Check of copyright-year complains about future dates now.
- (mcm1957) Checking for responsive design issues has been added.
- (mcm1957) Releaseinfo has been added to "checks" log.

### 3.2.4 (2025-01-16)
- (mcm1957) Suggested release of testing and adapter-core increased.

### 3.2.3 (2025-01-11)
- (mcm1957) An error is issued if js-controller dependency is missing.
- (mcm1957) Required js-controller has been increased to 5.0.19.
- (mcm1957) Recommended js-controller version is omitted if identical to required one.

### 3.2.2 (2024-11-01)
- (mcm1957) Link to open issues has been corrected.
- (mcm1957) Component name added to responsive check issues.

### 3.2.1 (2024-11-01)
- (mcm1957) Size checking for "divider" and "staticImage" suspended.

### 3.2.0 (2024-11-01)
- (oweitman) Script has been extended to use optionally local data for checking.
- (mcm1957) Warning if i18n is not used has been fixed [#324].
- (mcm1957) Check for importent issues has been added.
- (mcm1957) Checking of jsonConfig (initially) added.

### 3.1.4 (2024-10-26)
- (mcm1957) linter has been activated and issues reported have been fixed.
- (mcm1957) Blacklist for package/dependencies has been extended.
- (mcm1957) Recommend adapter-core 3.2.2 now.
- (mcm1957) Clearify test for "[E952] .npmignore not found". [#320]
- (mcm1957) Abort processing if iobroker.live not reachable. [#321]

### 3.1.3 (2024-10-11)
- (mcm1957) Checker no longer crash id no npm package exists.

### 3.1.2 (2024-10-04)
- (mcm1957) Require node 18 minimum as engines clause.

### 3.1.1 (2024-10-04)
- (mcm1957) "[E166] 'common.mode: extension' is unknown" has been fixed [#308]
- (mcm1957) "[E904] file iob_npm.done found in repository, but not found in .gitignore" removed as covered by [E503]. [#309]
- (mcm1957) "[E500] node_modules found" has been retricted to adapetr root. [#297]
- (mcm1957) Do not check main entry if common.mode none or extension.
- (mcm1957) Change "[W113] Adapter should support compact mode" text and honor common.compact set to false. [#300]

### 3.1.0 (2024-09-29)
- (mcm1957) "@iobroker/plugin-sentry" blacklisted as dependency [#301]
- (mcm1957) Accept .ts files as main file too. [#303]
- (mcm1957) [E405] and [E426] incorrect path has been corrected. [#299]

### 3.0.7 (2024-09-19)
- (mcm1957) "[W523] 'package-lock.json"'not found in repo!" reduced to suggestion. [#298]

### 3.0.6 (2024-09-13)
- (mcm1957) "[E124] Main file not found" no longer raised if `common.nogit` is set
- (mcm1957) 'Text of "common.main" is deprecated' has been adapted. [#266]
- (mcm1957) Ignore errors caused by complex .gitignor/.npmignore. [#288]

### 3.0.5 (2024-09-13)
- (mcm1957) '@iobroker/dev-server' is valid as dev-dependency. [#260]

### 3.0.4 (2024-09-12)
- (mcm1957) Abort with incorrect dependency definition fixed [#287]
- (mcm1957) Improve handling of malformed dependency definitions [#284]
- (mcm1957) Improve handling of malformed .releaseconfig.json files [#283]
- (mcm1957) Missing mandatory translations are considered an error now. [#277, #278]
- (mcm1957) '.npmignore found but "files" is used' is a warning now. [#274]
- (mcm1957) '@iobroker/dev-server' has been blacklisted as any dependency. [#260]
- (mcm1957) Do no longer require a js-controller dependency for wwwOnly adapters. [#250]

### 3.0.3 (2024-09-12)
- (mcm1957) Check for iob_npm.done at `.npmignore` has been removed [#294]

### 3.0.2 (2024-09-11)
- (mcm1957) Handling of a missing LICENSE file corrected. [#282]
- (mcm1957) [W126] Missing mandatory translation is an error now. [#293]
- (mcm1957) Record repochcker version used for tests.
- (mcm1957) Record GitHub commit-sha of last commit used for tests.

### 3.0.0 (2024-09-10)
- (mcm1957) Error and warning numbering has been reviewed and duplicates removed.
- (mcm1957) index.js has been split into seperated modules.

### 2.10.0 (2024-08-19)
- (mcm1957) Suggestions ([Sxxx] have been added).

### 2.9.1 (2024-08-12)
- (mcm1957) E162 - correct dependency check for js-controller. [#267].
- (mcm1957) E605 - copyright year range including whitespaces is now accepted. [#269].
- (mcm1957) E016 - missing vaiable expansion has been added. [#263].
- (mcm1957) E114 - typo at error message has been fixed [#261].

### 2.9.0 (2024-07-29)
- (mcm1957) Adapt text if sources-dist(-stable).json need a correction [#97].
- (mcm1957) Missing "common.mode" error text corrected [#249].
- (mcm1957) Files "iob" and "iobroker" are disallowed now [#248].
- (mcm1957) Checks related to @alcalzone/releasescript modified [#71].
- (mcm1957) Text of E114 (missing adminUI) adapted.

### 2.8.1 (2024-07-28)
- (mcm1957) Check of js-controller version has been corrected [#247].
- (mcm1957) Honor '>' at dependency checks too [#246].

### 2.8.0 (2024-07-28)
- (mcm1957) Copyright year check has been fixed for single year entries.
- (mcm1957) js-controller version check added [#233].
- (mcm1957) Check for fixed version dependencies and for github dependencies [#233].
- (mcm1957) Missing language files reduced to warning [#203].
- (mcm1957) Missing .gitignore is considered an error now.
- (mcm1957) "common.noConfig" no longer reported as error if "common.adminUI" is present [#245].
- (mcm1957) "common.noConfig" must match "common.adminUI" setting [#170].

### 2.7.2 (2024-07-26)
- (mcm1957) package-lock.json check fixed.

### 2.7.1 (2024-07-26)
- (mcm1957) Reduce setTimeout/setInterval error to warning temporary.

### 2.7.0 (2024-07-26)
- (mcm1957) Some non trivial keywords related to adapter are enforced now [#234].
- (mcm1957) Severity if [E105] / [W105] has been corrected [#204].
- (mcm1957) Disallow 'globalDependencies' at package.json [#204].
- (mcm1957) Several false positives for wwwOnly widgetadapters have been fixed [#230, #222].
- (mcm1957) Missing .npmignore is now considered an error [#229].
- (mcm1957) Usage of package.json 'files' section is now recommended.
- (mcm1957) If more than 7 common.news entries are present a warning is issued now [#232].
- (mcm1957) Versions listed at common.news are checked to exist at npm now [#226].
- (mcm1957) 'package-lock.json' is checked to exist at GitHub now [#188].
- (mcm1957) travis checks have been removed [#237].
- (mcm1957) Copyright year now honors commit year and npm publish year too [#237].

### 2.6.1 (2024-06-24)
- (mcm1957) Check "[W156] Adapter should support admin 5 UI (jsonConfig)" checks for reactUi now.

### 2.6.0 (2024-06-24)
- (mcm1957) Check has been aded to ensure keywords and common.keywords are present. [#200]
- (mcm1957) Detection of react has been added, gulpfile.js is accepted for react based UIs now. [#223]

### 2.5.1 (2024-06-24)
- (mcm1957) Suggestion to update dependencies to recommended version added.
- (mcm1957) Adapter-core recommended set to 3.1.6 [#220]

### 2.5.0 (2024-05-30)
- (mcm1957) Check to ensure that dependency revisions are available at repository added. [#180]

### 2.4.0 (2024-05-30)
- (mcm1957) Add check to protect sensitive data. [#195]
- (mcm1957) Add check to verify that dependencies and globalDepencies are of type array. [#90]

### 2.3.1 (2024-05-07)
- (mcm1957) Reduce number of missing translation warnings.
- (mcm1957) Seperate between required and recommended translations.
- (mcm1957) Log missing translations in detail.

### 2.3.0 (2024-05-07)
- (mcm1957) Elements marked as deprectaed added to blacklist.
- (mcm1957) Blacklist added to block elements at package.json and io-package.json.
- (mcm1957) Error [E000] will be raised now if repository cannot be accessed at all [#194].
- (mcm1957) Reading of package.json and io-package.json has been moved to head of tests.
- (mcm1957) Check minimum and recommended node version at package.json (#160)
- (mcm1957) Raise an error if version at package.json is lower than latest release at npmjs [#192]

### 2.2.3 (2024-03-29)
- (mcm1957) Checking of license has been improved

### 2.2.2 (2024-03-29)
- (mcm1957) Checking of adapter-core has been fixed
- (mcm1957) Load all potential interesting files, fixes [#149]

### 2.2.1 (2024-03-26)
- (mcm1957) Added check that own adapter is not listed at common.restartAdapters
- (mcm1957) Added check of version strings at common.news
- (mcm1957) Added check for recommended node version (node 18 for now)
- (mcm1957) Disallow common.mode == subscribe
- (mcm1957) Deprecate common.wakeup
- (mcm1957) Added check for adapter-core version (>= 3.0.6)

### 2.2.0 (2024-03-24)
- (klein0r) Added check for licenseInformation
- (klein0r) Added check for deprecated license
- (klein0r) Added check for required attribute common.tier
- (klein0r) Added check for disallowed attribute common.automaticUpgrade

### 2.1.13 (2024-01-02)
- (bluefox) Corrected rule W156: adminUI.config === 'none' is allowed

### 2.1.12 (2023-09-21)
- (bluefox) Added check of using '\_' in adapter name

### 2.1.11 (2023-09-05)
- (bluefox) Added check of iobroker.js-controller in dependencies

### 2.1.7 (2023-08-14)
- (mcm57) Update index.js - fix typo in error message (packet.json)
- (mcm57) Update index.js - renumber E504/1 to 519 - fixes #112

### 2.1.6 (2022-12-08)
- (bluefox) added better error logging

### 2.1.5 (2022-12-07)
- (bluefox) added check of `.releaseconfig.json` file

### 2.1.4 (2022-08-19)
- (bluefox) Added check for adapter name: it may not start with '\_'

### 2.1.2 (2022-07-14)
- (bluefox) Fixed some errors

### 2.1.0 (2022-05-26)
- (bluefox) Added support for jsonConfig.json5 and jsonCustom.json5

### 2.0.5 (2022-05-22)
- (bluefox) Made it possible to run with npx

## License

The MIT License (MIT)

Copyright (c) 2014-2025 Denis Haev <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN


THE SOFTWARE.

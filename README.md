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

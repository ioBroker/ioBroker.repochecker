# Adapter repository checker
This is a code for frontend and back-end of the service https://adapter-check.iobroker.in/

If you want to add your adapter to the public ioBroker repository, all tests on this page must be OK.

## How to test via cli
You can pass your repository as a parameter to test

``npx @iobroker/repochecker <repo> [branch]``

```
npx @iobroker/repochecker https://github.com/ioBroker/ioBroker.javascript master
```

Branch (`master/main/dev`) is optional.

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

## Changelog
### 3.0.7 (2024-09-19)
* (mcm1957) "[W523] 'package-lock.json"'not found in repo!" reduced to suggestion. [#298]

### 3.0.6 (2024-09-13)
* (mcm1957) "[E124] Main file not found" no longer raised if common.nogit is set
* (mcm1957) 'Text of "common.main" is deprecated' has been adapted. [#266]
* (mcm1957) Ignore errors caused by complex .gitignor/.npmignore. [#288]

### 3.0.5 (2024-09-13)
* (mcm1957) '@iobroker/dev-server' is valid as dev-dependency. [#260]

### 3.0.4 (2024-09-12)
* (mcm1957) Abort with incorrect dependency definition fixed [#287]
* (mcm1957) Improve handling of malformed dependency definitions [#284]
* (mcm1957) Improve handling of malformed .releaseconfig.json files [#283]
* (mcm1957) Missing mandatory translations are considered an error now. [#277, #278]
* (mcm1957) '.npmignore found but "files" is used' is a warning now. [#274]
* (mcm1957) '@iobroker/dev-server' has been blacklisted as any dependency. [#260]
* (mcm1957) Do no longer require a js-controller dependecy for wwwOnly adapters. [#250]

### 3.0.3 (2024-09-12)
* (mcm1957) Check for iob_npm.done at .npmignore has been removed [#294]

### 3.0.2 (2024-09-11)
* (mcm1957) Handling of missing LICENSE file corrected. [#282]
* (mcm1957) [W126] Missing mandatory translation is error now. [#293]
* (mcm1957) Record repochcker version used for tests.
* (mcm1957) Record github commit-sha of last commit used for tests.

### 3.0.0 (2024-09-10)
* (mcm1957) Error and warning numbering has been reviewed and duplicates removed.
* (mcm1957) index.js has been split into seperated modules.

### 2.10.0 (2024-08-19)
* (mcm1957) Suggestions ([Sxxx] have been added).

### 2.9.1 (2024-08-12)
* (mcm1957) E162 - correct dependency check for js-controller. [#267].
* (mcm1957) E605 - copyright year range including whitespaces is now accepted. [#269].
* (mcm1957) E016 - missing vaiableexpansion has been added. [#263].
* (mcm1957) E114 - typo at error message has been fixed [#261].

### 2.9.0 (2024-07-29)
* (mcm1957) Adapt text if sources-dist(-stable).json need a correction [#97].
* (mcm1957) Missing "common.mode" error text corrected [#249].
* (mcm1957) Files "iob" and "iobroker" are disallowed now [#248].
* (mcm1957) Checks related to @alcalzone/releasescript modified [#71].
* (mcm1957) Text of E114 (missing adminUI) adapted.

### 2.8.1 (2024-07-28)
* (mcm1957) Check of js-controller version has been corrected [#247].
* (mcm1957) Honor '>' at dependency checks too [#246].

### 2.8.0 (2024-07-28)
* (mcm1957) Copyright year check has been fixed for single year entries.
* (mcm1957) js-controller version check added [#233].
* (mcm1957) Check for fixed version dependencies and for github dependencies [#233].
* (mcm1957) Missing language files reduced to warning [#203].
* (mcm1957) Missing .gitignore is considered an error now.
* (mcm1957) "common.noConfig" no longer reported as error if "common.adminUI" is present [#245].
* (mcm1957) "common.noConfig" must match "common.adminUI" setting [#170].

### 2.7.2 (2024-07-26)
* (mcm1957) package-lock.json check fixed.

### 2.7.1 (2024-07-26)
* (mcm1957) Reduce setTimeout/setInterval error to warning temporary.

### 2.7.0 (2024-07-26)
* (mcm1957) Some non trivial keywords related to adapter are enforced now [#234].
* (mcm1957) Severity if [E105] / [W105] has been corrected [#204].
* (mcm1957) Disallow 'globalDependencies' at package.json [#204].
* (mcm1957) Several false positives for wwwOnly widgetadapters have been fixed [#230, #222].
* (mcm1957) Missing .npmignore is now considered an error [#229].
* (mcm1957) Usage of package.json 'files' section is now recommended.
* (mcm1957) If more than 7 common.news entries are present a warning is issued now [#232].
* (mcm1957) Versions listed at common.news are checked to exist at npm now [#226].
* (mcm1957) 'package-lock.json' is checked to exist at GitHub now [#188].
* (mcm1957) travis checks have been removed [#237].
* (mcm1957) Copyright year now honors commit year and npm publish year too [#237].

### 2.6.1 (2024-06-24)
* (mcm1957) Check "[W156] Adapter should support admin 5 UI (jsonConfig)" checks for reactUi now.

### 2.6.0 (2024-06-24)
* (mcm1957) Check has been aded to ensure keywords and common.keywords are present. [#200]
* (mcm1957) Detection of react has been added, gulpfile.js is accepted for react based UIs now. [#223]

### 2.5.1 (2024-06-24)
* (mcm1957) Suggestion to update dependencies to recommended version added.
* (mcm1957) Adapter-core recommended set to 3.1.6 [#220]

### 2.5.0 (2024-05-30)
* (mcm1957) Check to ensure that dependency revisions are available at repository added. [#180]

### 2.4.0 (2024-05-30)
* (mcm1957) Add check to protect sensitive data. [#195]
* (mcm1957) Add check to verify that dependencies and globalDepencies are of type array. [#90]

### 2.3.1 (2024-05-07)
* (mcm1957) Reduce number of missing translation warnings.
* (mcm1957) Seperate between required and recommended translations.
* (mcm1957) Log missing translations in detail.

### 2.3.0 (2024-05-07)
* (mcm1957) Elements marked as deprectaed added to blacklist.
* (mcm1957) Blacklist added to block elements at package.json and io-package.json.
* (mcm1957) Error [E000] will be raised now if repository cannot be accessed at all [#194].
* (mcm1957) Reading of package.json and io-package.json has been moved to head of tests.
* (mcm1957) Check minimum and recommended node version at package.json (#160)
* (mcm1957) Raise an error if version at package.json is lower than latest release at npmjs [#192]

### 2.2.3 (2024-03-29)
* (mcm1957) Checking of license has been improved

### 2.2.2 (2024-03-29) 
* (mcm1957) Checking of adapter-core has been fixed
* (mcm1957) Load all potential interesting files, fixes [#149]

### 2.2.1 (2024-03-26)
* (mcm1957) Added check that own adapter is not listed at common.restartAdapters
* (mcm1957) Added check of version strings at common.news
* (mcm1957) Added check for recommended node version (node 18 for now)
* (mcm1957) Disallow common.mode == subscribe
* (mcm1957) Deprecate common.wakeup
* (mcm1957) Added check for adapter-core version (>= 3.0.6)

### 2.2.0 (2024-03-24)
* (klein0r) Added check for licenseInformation
* (klein0r) Added check for deprecated license
* (klein0r) Added check for required attribute common.tier
* (klein0r) Added check for disallowed attribute common.automaticUpgrade

### 2.1.13 (2024-01-02)
* (bluefox) Corrected rule W156: adminUI.config === 'none' is allowed

### 2.1.12 (2023-09-21)
* (bluefox) Added check of using '_' in adapter name

### 2.1.11 (2023-09-05)
* (bluefox) Added check of iobroker.js-controller in dependencies

### 2.1.7 (2023-08-14)
* (mcm57) Update index.js - fix typo in error message (packet.json)
* (mcm57) Update index.js - renumber E504/1 to 519 - fixes #112

### 2.1.6 (2022-12-08)
* (bluefox) added better error logging

### 2.1.5 (2022-12-07)
* (bluefox) added check of `.releaseconfig.json` file

### 2.1.4 (2022-08-19)
* (bluefox) Added check for adapter name: it may not start with '_'

### 2.1.2 (2022-07-14)
* (bluefox) Fixed some errors

### 2.1.0 (2022-05-26)
* (bluefox) Added support for jsonConfig.json5 and jsonCustom.json5

### 2.0.5 (2022-05-22)
* (bluefox) Made it possible to run with npx

## License
The MIT License (MIT)

Copyright (c) 2014-2024 Denis Haev <dogafox@gmail.com>

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
